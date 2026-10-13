#!/usr/bin/env bash
set -euo pipefail
# Local development only. Production must supply a managed MySQL database.
if docker container inspect depttrack-mysql >/dev/null 2>&1; then
  docker start depttrack-mysql >/dev/null
else
  docker run -d --name depttrack-mysql \
    -e MYSQL_RANDOM_ROOT_PASSWORD=yes -e MYSQL_DATABASE=depttrack \
    -e MYSQL_USER=depttrack -e MYSQL_PASSWORD=local-dev-only \
    -p 127.0.0.1:3306:3306 -v depttrack-mysql-data:/var/lib/mysql \
    mysql:8.4@sha256:24989179f58856db763f418010c1169fecc944e3ec1ea7e921572d83eb070f70 >/dev/null
fi
for attempt in $(seq 1 60); do
  if docker exec depttrack-mysql mysqladmin ping --silent >/dev/null 2>&1; then
    echo 'MySQL is ready.'
    exit 0
  fi
  sleep 1
done
echo 'MySQL did not become ready within 60 seconds.' >&2
exit 1
