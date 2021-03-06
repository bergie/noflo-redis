let baseDir; let
  chai;
const noflo = require('noflo');
const redis = require('redis');

if (!noflo.isBrowser()) {
  chai = require('chai');
  const path = require('path');
  baseDir = path.resolve(__dirname, '../');
} else {
  baseDir = 'noflo-redis';
}

describe('Publish component', () => {
  let c = null;
  let chan = null;
  let msg = null;
  let out = null;
  let err = null;
  let client = null;
  let client2 = null;
  before(function () {
    this.timeout(4000);
    const loader = new noflo.ComponentLoader(baseDir);
    return loader.load('redis/Publish')
      .then((instance) => {
        c = instance;
        chan = noflo.internalSocket.createSocket();
        c.inPorts.channel.attach(chan);
        msg = noflo.internalSocket.createSocket();
        c.inPorts.message.attach(msg);
        client = redis.createClient();
        client2 = redis.createClient();
        const clientSocket = noflo.internalSocket.createSocket();
        c.inPorts.client.attach(clientSocket);
        clientSocket.send(client2);
      });
  });
  after((done) => client.quit((err) => {
    if (err) { return done(err); }
    client2.quit(done);
  }));
  beforeEach(() => {
    out = noflo.internalSocket.createSocket();
    c.outPorts.out.attach(out);
    err = noflo.internalSocket.createSocket();
    c.outPorts.error.attach(err);
  });
  afterEach(() => {
    c.outPorts.out.detach(out);
    out = null;
    c.outPorts.error.detach(err);
    err = null;
  });

  describe('with a fully-qualified channel name', () => it('should transmit the message to the subscriber', (done) => {
    const channelName = 'regularchannel';
    chan.send(channelName);
    client.subscribe(channelName);

    err.on('data', done);

    client.on('message', (channel, message) => {
      chai.expect(channel).to.equal(channelName);
      chai.expect(message).to.equal('Hello, there!');
      client.unsubscribe();
      done();
    });

    client.on('subscribe', () => {
      msg.send('Hello, there!');
      msg.disconnect();
    });
  }));

  describe('with a wildcard channel', () => it('should transmit the message to the subscriber', (done) => {
    const channelName = 'wildchannel.foo';
    chan.send(channelName);
    client.psubscribe('wildchannel.*');

    err.on('data', done);

    client.on('pmessage', (pattern, channel, message) => {
      chai.expect(channel).to.equal(channelName);
      chai.expect(message).to.equal('Hello, there!');
      client.punsubscribe();
      done();
    });

    client.on('psubscribe', () => {
      msg.send('Hello, there!');
      msg.disconnect();
    });
  }));
});
