FROM ubuntu:14.04
MAINTAINER Vincent Fiduccia <vincent@rancher.com>

# Install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm git ca-certificates
RUN update-alternatives --install /usr/bin/node node /usr/bin/nodejs 10
RUN npm install -g forever

# Install npm modules
ADD package.json /tmp/package.json
RUN cd /tmp && npm install
RUN mkdir -p /opt/console-agent && cp -a /tmp/node_modules /opt/app

WORKDIR /opt/console-agent
ADD . /opt/console-agent

EXPOSE 8001

CMD ["npm","run","forever"]
