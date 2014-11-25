#!/usr/bin/env node

var urllib = require('url');
var net = require('net');
var spawn = require('child_process').spawn;

var WS = require('ws');
var request = require('request');

var argv = require('minimist')(process.argv.slice(2),{default: {
    'help':   false,
    'bind':   '0.0.0.0',
    'port':   8001,
    'docker': 'http://unix:/var/run/docker.sock'
  }, alias: {
    'help':   'h',
    'bind':   'b',
    'port':   'p',
    'docker': 'd'
  }
});

if ( argv.help )
{
  console.log('Usage:', process.argv[1],'[--port <num>] [--bind <ip address>] [--docker <url for docker API>]');
  console.log('  --help: Show this message, but you already know that.');
  console.log('  --port <num>: TCP port to listen on (default: 8001');
  console.log('  --bind <ip address>: IP address to bind to/listen on (default: 0.0.0.0');
  console.log('  --docker <url>: URL to connect to the docker remote API:');
  console.log('    e.g. remote host: "http://docker.host:2375"');
  console.log('    e.g. local socket: "http://unix:/var/run/docker.sock:" (default)');
  process.exit(0);
}

// Strip trailing slashes
argv.docker = argv.docker.replace(/\/+$/,'');

log('Listening on', argv.bind+':'+argv.port, 'for Docker at', argv.docker);

var server = new WS.Server({
  port: argv.port,
  host: argv.bind
});

server.on('connection', function(client) {
  var ip = client.upgradeReq.connection.remoteAddress;

  // The first section of the request path is the container ID
  var parsed = urllib.parse(client.upgradeReq.url, true);

  var path = parsed.pathname;
  var containerId = path.substr(1).replace(/\/.*$/,'');
  var shell = parsed.query.shell || '/bin/bash';

  log('Connection from', ip, 'for', containerId, '('+shell+')');

  exec(containerId, shell, function(err, execId) {
    if ( err )
    {
      error('Error:', err);
      client.terminate();
    }
    else
    {
      start(client, execId);
    }
  });
});

function exec(containerId, cmd, cb)
{
  request({
    url: argv.docker +'/containers/'+ encodeURIComponent(containerId) +'/exec',
    method: 'POST',
    json: true,
    body: {
      'AttachStdin': true,
      'AttachStdout': true,
      'Tty': true,
      'Cmd': [cmd],
      'Container': 'itsubuntu'
    }
  }, done);

  function done(err, res, body) {
    if ( err )
    {
      error('Error in exec 1:', err);
      return void cb(err);
    }

    if ( res.statusCode === 201 )
    {
      log('Created exec', body.Id);
      cb(null, body.Id);
    }
    else
    {
      error('Error in exec 2:', body);
      cb(new Error(body));
    }
  }
}

function start(client, execId)
{
  log('Starting ('+ execId +')');
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
//    log('From docker ('+ execId +'):', data.toString('utf8'));
    if ( client.readyState == WS.OPEN )
    {
      client.send(data, {binary: false});
    }
  });

  docker.on('error', function(err) {
    log('Docker error ('+ execId +'):', err);
  });

  docker.on('close', function() {
    log('Docker closing ('+ execId +')');
    client.terminate();
  });

  docker.on('end', function() {
    log('Docker ending ('+ execId +')');
    if ( client.readyState == WS.OPEN )
    {
      client.terminate();
    }
  });

  client.on('message', function(data) {
//      log('From client ('+ execId +'):', data.toString('utf8'));
    docker.write(data.toString('utf8'));
  });

  client.on('close', function() {
    log('Client closing ('+ execId +')');

    // Send a random ctrl-D to attempt to kill the bash process.
    // see https://github.com/docker/docker/issues/9098
    // and https://github.com/docker/docker/pull/9167
    // @TODO remove when this is fixed in Docker
    docker.write('\u0004');
    docker.end();
  });
}

function log(/*arguments*/)
{
  var args = Array.prototype.slice.call(arguments);
  args.unshift('['+ (new Date()).toISOString() +']');
  console.log.apply(console,args);
}

function error(/*arguments*/)
{
  var args = Array.prototype.slice.call(arguments);
  args.unshift('['+ (new Date()).toISOString() +']');
  console.error.apply(console,args);
}
