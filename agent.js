#!/usr/bin/env node

var urllib = require('url');
var net = require('net');
var spawn = require('child_process').spawn;
var fs = require('fs');

var WS = require('ws');
var request = require('request');
var JWT = require('jsonwebtoken');

var argv = require('minimist')(process.argv.slice(2),{default: {
    'help':   false,
    'bind':   '0.0.0.0',
    'port':   8001,
    'key':    null,
    'docker': 'http://unix:/var/run/docker.sock:/v1.15',
  }, alias: {
    'help':   'h',
    'bind':   'b',
    'port':   'p',
    'key':    'k',
    'docker': 'd',
  }
});

if ( argv.help )
{
  help();
  process.exit(1);
}

// Strip trailing slashes
argv.docker = argv.docker.replace(/\/+$/,'');

// Get the public key
var publicKey = '';
if (argv.key)
{
  if (argv.key.indexOf('-----BEGIN CERTIFICATE-----') === 0)
  {
    publicKey = argv.key;
  }
  else
  {
    try
    {
      publicKey = fs.readFileSync(argv.key,'utf8');
    }
    catch(e)
    {
      console.error('Public key not found:', e);
      process.exit(1);
    }
  }
}
else
{
  console.error('Public key not provided');
  help();
  process.exit(1);
}

// ------------

var server = new WS.Server({
  port: argv.port,
  host: argv.bind
});

server.on('connection', connection);

/*
process.on('SIGINT', function() {
  server.close();
});
*/

console.error('Listening on', argv.bind+':'+argv.port, 'for Docker at', argv.docker);

// ------------

function connection(client) {
  var ip = client.upgradeReq.connection.remoteAddress;
  userLog('Opened connection');

  var parsed = urllib.parse(client.upgradeReq.url, true);
  var rawToken = parsed.query.token;
  if (!rawToken)
  {
    return void userError('No token');
  }

  JWT.verify(rawToken, publicKey, function(err, token) {
    if ( err )
    {
      return void userError('Invalid token:',err);
    }

    userLog('Verified token for', token.exec.Container);
    exec(token.exec, function(err, execId) {
      if ( err )
      {
        return void userError(err);
      }

      start(execId);
    });
  });

  function exec(body, cb)
  {
    request({
      url: argv.docker +'/containers/'+ encodeURIComponent(body.Container) +'/exec',
      method: 'POST',
      json: true,
      body: body
    }, done);

    function done(err, res, body) {
      if ( err )
      {
        userError('Error in exec 1:', err);
        return void cb(err);
      }

      if ( res.statusCode === 201 )
      {
        userLog('Created exec', body.Id);
        cb(null, body.Id);
      }
      else
      {
        userError('Error in exec 2:', body);
        cb(new Error(body));
      }
    }
  }

  function start(execId)
  {
    userLog('Starting ('+ execId +')');
    var docker = request({
      url: argv.docker+'/exec/'+ execId +'/start',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'Detach': false,
        'Tty': true
      })
    });

    docker.on('data', function(data) {
      // userLog('From docker ('+ execId +'):', data.toString('utf8'));
      if ( client.readyState == WS.OPEN )
      {
        client.send(data.toString('base64'), {binary: false});
      }
    });

    docker.on('error', function(err) {
      userLog('Docker error ('+ execId +'):', err);
    });

    docker.on('end', function() {
      userLog('Docker closing ('+ execId +')');
      if ( client.readyState == WS.OPEN )
      {
        client.terminate();
      }
    });

    client.on('message', function(data) {
      // userLog('From client ('+ execId +'):', data.toString('utf8'));
      docker.write(new Buffer(data,'base64'));
    });

    client.on('end', function() {
      userLog('end');
    });

    client.on('close', function() {
      userLog('Client closing ('+ execId +')');

      // Send a random ctrl-D to attempt to kill the bash process.
      // see https://github.com/docker/docker/issues/9098
      // and https://github.com/docker/docker/pull/9167
      // @TODO remove when this is fixed in Docker
      docker.write('\u0004');
      docker.end();
    });
  }

  function userError(msg)
  {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('['+ ip +']');
    args.unshift('['+ (new Date()).toISOString() +']');
    console.error.apply(null,args);

    client.send('ERROR:'+msg, {binary: false}, function() {
      client.terminate();
    });
  }

  function userLog(/*arguments*/)
  {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('['+ ip +']');
    args.unshift('['+ (new Date()).toISOString() +']');
    console.log.apply(null,args);
  }
}

// ------------

function help()
{
  console.log('Usage:', process.argv[1],'--key <path|PEM-encoded string> [--port <num>] [--bind <ip address>] [--docker <url for docker API>]');
  console.log('  -h, --help: Show this message, but you already know that.');
  console.log('  -k  --key=<path|PEM-encoded string>: Path to a PEM-encoded public key, or the actual key as a PEM-encoded string');
  console.log('  -p, --port=<num>: TCP port to listen on (default: 8001');
  console.log('  -b, --bind=<ip address>: IP address to bind to/listen on (default: 0.0.0.0');
  console.log('  -d, --docker=<url>: URL to connect to the docker remote API:');
  console.log('    e.g. remote host: "http://docker.host:2375"');
  console.log('    e.g. local socket: "http://unix:/var/run/docker.sock:/v1.15" (default)');
}
