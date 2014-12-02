console-agent
-------------
Agent for [term.js](https://github.com/chjj/term.js) to talk to a [Docker](https://github.com/docker/docker) container TTY over a WebSocket

Installation
============
```bash
  git clone https://github.com/rancherio/console-agent
  cd console-agent
  npm install
```

Usage
=====
Start up the agent on a docker host:
```bash
  ./agent.js [--port <num>] [--bind <ip address>] [--docker <url for docker API>] [--key <PEM-encoded string or path to JWT public key file>]
```

Create an exec request through the cattle API to get a JSON Web Token:
```bash
  curl -X POST 'http://cattle-host:8080/v1/containers/<container_id>?exec'
```
  Response:
  ```http
    {
      ...
    }
  ```

And connect a websocket to the host and port specified:
```javascript
  var socket = new WebSocket('ws://<host>:<port>/?token=<JWT string>');
  var term  = new Terminal({ // from term.js
    cols: 80,
    rows: 24
  });

  term.on('data', function(data) {
    socket.send(data);
  });

  socket.onmessage = function(message) {
    term.write(message.data);
  });

  socket.onclose = function() {
    term.destroy();
  }

  term.open();
```

License
=======
Copyright (c) 2014 [Rancher Labs, Inc.](http://rancher.com)

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

[http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
