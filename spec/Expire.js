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

describe('Expire component', () => {
  let c = null;
  let key = null;
  let expire = null;
  let out = null;
  let err = null;
  let client = null;
  before(function () {
    this.timeout(4000);
    const loader = new noflo.ComponentLoader(baseDir);
    return loader.load('redis/Expire')
      .then((instance) => {
        c = instance;
        key = noflo.internalSocket.createSocket();
        c.inPorts.key.attach(key);
        expire = noflo.internalSocket.createSocket();
        c.inPorts.expire.attach(expire);
        client = redis.createClient();
        const clientSocket = noflo.internalSocket.createSocket();
        c.inPorts.client.attach(clientSocket);
        clientSocket.send(client);
      });
  });
  after((done) => client.quit(done));
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

  describe('with a missing key', () => it('should send an error', (done) => {
    err.on('data', (data) => {
      chai.expect(data).to.be.an('error');
      chai.expect(data.message).to.equal('No value');
      chai.expect(data.key).to.equal('testmissingkey');
      done();
    });

    key.send('testmissingkey');
    expire.send(60);
  }));

  describe('with an existing key', () => {
    it('should send the key', (done) => {
      err.on('data', done);
      out.on('data', (data) => {
        chai.expect(data).to.equal('newkey');
        done();
      });

      client.set('newkey', 'baz', (err, reply) => {
        if (err) { return done(err); }
        key.send('newkey');
        expire.send(1);
      });
    });
    it('should have expired the key', (done) => setTimeout(() => client.get('newkey', (err, reply) => {
      if (err) { return done(err); }
      chai.expect(reply).to.be.a('null');
      done();
    }),
    1100));
  });
});
