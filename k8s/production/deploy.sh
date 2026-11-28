#!/bin/sh
# Production deploy. Installed on the server as /usr/local/bin/spendly-deploy and set as the forced
# command of CI's SSH key (docs/CLOUD.md), so that key can run this script and nothing else.
# CI sends one thing, a commit SHA; only commits already on main are deployed.
set -eu
sha=${SSH_ORIGINAL_COMMAND:-${1:-}}
if ! printf '%s' "$sha" | grep -Eqx '[0-9a-f]{40}'; then echo "expected a 40-character commit SHA" >&2; exit 2; fi

export KUBECONFIG="$HOME/.kube/config" # the "deployer" account: namespace spendly only
cd /opt/spendly
git fetch -q origin main
git merge-base --is-ancestor "$sha" origin/main || { echo "$sha is not on main" >&2; exit 3; }
git checkout -qf "$sha"

tag="sha-$(printf '%s' "$sha" | cut -c1-7)"
sed -i "s/newTag: .*/newTag: $tag/" k8s/production/kustomization.yaml
kubectl apply -k k8s/production
kubectl -n spendly rollout status deploy/spendly --timeout=300s
echo "deployed $tag"
