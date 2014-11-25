FROM ubuntu:14.04
RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm git ca-certificates
RUN git clone https://github.com/rancherio/console-agent /opt/console-agent
RUN cd /opt/console-agent && npm install
ADD . /opt/console-agent
EXPOSE 8001
CMD [/opt/console-agent/agent.js']
