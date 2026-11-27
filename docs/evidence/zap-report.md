# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 0 |
| Low | 1 |
| Informational | 2 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Info | Informational | http://localhost:30080 | Percentage of responses with status code 2xx | 68 % |
| Info | Informational | http://localhost:30080 | Percentage of responses with status code 4xx | 31 % |
| Info | Informational | http://localhost:30080 | Percentage of endpoints with content type application/json | 93 % |
| Info | Informational | http://localhost:30080 | Percentage of endpoints with content type text/html | 6 % |
| Info | Informational | http://localhost:30080 | Percentage of endpoints with method GET | 46 % |
| Info | Informational | http://localhost:30080 | Percentage of endpoints with method POST | 53 % |
| Info | Informational | http://localhost:30080 | Count of total endpoints | 15    |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| Unexpected Content-Type was returned | Low | 2 |
| A Client Error response code was returned by the server | Informational | 13 |
| Non-Storable Content | Informational | 2 |




## Alert Detail



### [ Unexpected Content-Type was returned ](https://www.zaproxy.org/docs/alerts/100001/)



##### Low (High)

### Description

A Content-Type of text/html was returned by the server.
This is not one of the types expected to be returned by an API.
Raised by the 'Alert on Unexpected Content Types' script

* URL: http://localhost:30080
  * Node Name: `http://localhost:30080`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://localhost:30080/
  * Node Name: `http://localhost:30080/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``


Instances: 2

### Solution



### Reference




#### Source ID: 4

### [ A Client Error response code was returned by the server ](https://www.zaproxy.org/docs/alerts/100000/)



##### Informational (High)

### Description

A response code of 404 was returned by the server.
This may indicate that the application is failing to handle unexpected input correctly.
Raised by the 'Alert on HTTP Response Code Error' script

* URL: http://localhost:30080/911686973357186504
  * Node Name: `http://localhost:30080/911686973357186504`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:30080/api
  * Node Name: `http://localhost:30080/api`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:30080/api/
  * Node Name: `http://localhost:30080/api/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:30080/api/7311353145411970943
  * Node Name: `http://localhost:30080/api/7311353145411970943`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:30080/api/actuator/health
  * Node Name: `http://localhost:30080/api/actuator/health`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:30080/api/sync
  * Node Name: `http://localhost:30080/api/sync ()({since,changes:[{kind,id,updatedAt,data:{amount,cat,note}}]})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://localhost:30080/computeMetadata/v1/
  * Node Name: `http://localhost:30080/computeMetadata/v1/ ()({since,changes:[{kind,id,updatedAt,data:{amount,cat,note}}]})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:30080/latest/meta-data/
  * Node Name: `http://localhost:30080/latest/meta-data/ ()({since,changes:[{kind,id,updatedAt,data:{amount,cat,note}}]})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:30080/metadata/instance
  * Node Name: `http://localhost:30080/metadata/instance ()({since,changes:[{kind,id,updatedAt,data:{amount,cat,note}}]})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:30080/metadata/v1
  * Node Name: `http://localhost:30080/metadata/v1 ()({since,changes:[{kind,id,updatedAt,data:{amount,cat,note}}]})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:30080/opc/v1/instance/
  * Node Name: `http://localhost:30080/opc/v1/instance/ ()({since,changes:[{kind,id,updatedAt,data:{amount,cat,note}}]})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:30080/opc/v2/instance/
  * Node Name: `http://localhost:30080/opc/v2/instance/ ()({since,changes:[{kind,id,updatedAt,data:{amount,cat,note}}]})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://localhost:30080/openstack/latest/meta_data.json
  * Node Name: `http://localhost:30080/openstack/latest/meta_data.json ()({since,changes:[{kind,id,updatedAt,data:{amount,cat,note}}]})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``


Instances: 13

### Solution



### Reference



#### CWE Id: [ 388 ](https://cwe.mitre.org/data/definitions/388.html)


#### WASC Id: 20

#### Source ID: 4

### [ Non-Storable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are not storable by caching components such as proxy servers. If the response does not contain sensitive, personal or user-specific information, it may benefit from being stored and cached, to improve performance.

* URL: http://localhost:30080/api/health
  * Node Name: `http://localhost:30080/api/health`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: http://localhost:30080/api/sync
  * Node Name: `http://localhost:30080/api/sync ()({since,changes:[{kind,id,updatedAt,data:{amount,cat,note}}]})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``


Instances: 2

### Solution

The content may be marked as storable by ensuring that the following conditions are satisfied:
The request method must be understood by the cache and defined as being cacheable ("GET", "HEAD", and "POST" are currently defined as cacheable)
The response status code must be understood by the cache (one of the 1XX, 2XX, 3XX, 4XX, or 5XX response classes are generally understood)
The "no-store" cache directive must not appear in the request or response header fields
For caching by "shared" caches such as "proxy" caches, the "private" response directive must not appear in the response
For caching by "shared" caches such as "proxy" caches, the "Authorization" header field must not appear in the request, unless the response explicitly allows it (using one of the "must-revalidate", "public", or "s-maxage" Cache-Control response directives)
In addition to the conditions above, at least one of the following conditions must also be satisfied by the response:
It must contain an "Expires" header field
It must contain a "max-age" response directive
For "shared" caches such as "proxy" caches, it must contain a "s-maxage" response directive
It must contain a "Cache Control Extension" that allows it to be cached
It must have a status code that is defined as cacheable by default (200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501).

### Reference


* [ https://datatracker.ietf.org/doc/html/rfc7234 ](https://datatracker.ietf.org/doc/html/rfc7234)
* [ https://datatracker.ietf.org/doc/html/rfc7231 ](https://datatracker.ietf.org/doc/html/rfc7231)
* [ https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html ](https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)


#### CWE Id: [ 524 ](https://cwe.mitre.org/data/definitions/524.html)


#### WASC Id: 13

#### Source ID: 3


