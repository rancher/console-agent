console-agent
-------------
Agent for [chjj/term.js](term.js) to talk to a [docker/docker](Docker) container TTY over a WebSocket

Installation
============
```bash
  git clone https://github.com/rancherio/console-agent
  cd console-agent
  npm install
```

Usage
=====
Start up the agent:
```bash
  ./agent.js [--port <num>] [--bind <ip address>] [--docker <url for docker API>]
```

And connect a websocket to the host and port specified (any IP of the host on port 8001 by default):
```javascript
  var socket = new WebSocket('ws://<host>:<port>/<container_id>?shell=/bin/bash');
  var term  = new Terminal({ // from term.js
    cols: 80,
    rows: 24,
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
