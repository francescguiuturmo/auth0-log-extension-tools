const _ = require('lodash');
const expect = require('chai').expect;
const tools = require('auth0-extension-tools');

const helpers = require('../helpers');
const LogsProcessor = require('../../src/processor');
const webtaskStorage = require('../helpers/webtaskStorage');

const createProcessor = (data, settings) => {
  const options = _.assign({ },
    {
      domain: 'foo.auth0.local',
      clientId: '1',
      clientSecret: 'secret',
      maxRunTimeSeconds: 1
    },
    settings
  );

  const storage = webtaskStorage(data);
  return new LogsProcessor(webtaskStorage.context(storage), options);
};

describe('LogsProcessor', () => {
  describe('#init', () => {
    it('should throw error if the storageContext is undefined', (done) => {
      const init = () => {
        const processor = new LogsProcessor();
      };

      expect(init).to.throw(tools.ArgumentError);
      done();
    });

    it('should throw error if the options are undefined', (done) => {
      const init = () => {
        const processor = new LogsProcessor({ });
      };

      expect(init).to.throw(tools.ArgumentError);
      done();
    });

    it('should init logger', (done) => {
      let logger;
      const init = () => {
        logger = createProcessor();
      };

      expect(init).to.not.throw(Error);
      expect(logger).to.be.an.instanceof(LogsProcessor);
      done();
    });
  });

  describe('#run', () => {
    beforeEach((done) => {
      helpers.mocks.token();
      done();
    });

    it('should process logs and send response', (done) => {
      helpers.mocks.logs({ times: 6 });

      const processor = createProcessor();
      processor.run((logs, cb) => setTimeout(() => cb()))
        .then((result) => {
          expect(result).to.be.an('object');
          expect(result.status).to.be.an('object');
          expect(result.status.logsProcessed).to.equal(500);
          expect(result.checkpoint).to.equal('500');
          done();
        });
    });

    it('should process logs and done by timelimit', (done) => {
      helpers.mocks.logs({ times: 2 });

      const processor = createProcessor();
      processor.run((logs, cb) => setTimeout(() => cb(), 500))
        .then((result) => {
          expect(result).to.be.an('object');
          expect(result.status).to.be.an('object');
          expect(result.status.logsProcessed).to.equal(200);
          expect(result.checkpoint).to.equal('200');
          done();
        });
    });

    it('should process logs and done by error', (done) => {
      helpers.mocks.logs();
      helpers.mocks.logs({ error: 'bad request' });

      const processor = createProcessor();
      processor.run((logs, cb) => setTimeout(() => cb()))
        .then((result) => {
          expect(result).to.be.an('object');
          expect(result.status).to.be.an('object');
          expect(result.status.error).to.be.instanceof(Error, /bad request/);
          expect(result.status.logsProcessed).to.equal(100);
          expect(result.checkpoint).to.equal('100');
          done();
        });
    });

    it('should process logs and done with error by timeout', (done) => {
      helpers.mocks.logs();

      const processor = createProcessor();
      processor.run((logs, cb) => setTimeout(() => cb(new Error('ERROR')), 500))
        .then((result) => {
          expect(result).to.be.an('object');
          expect(result.status).to.be.an('object');
          expect(result.status.error).to.be.an.instanceof(Error, /ERROR/);
          expect(result.status.logsProcessed).to.equal(0);
          expect(result.checkpoint).to.equal(null);
          done();
        });
    });

    it('should process logs and done by error in onLogsReceived', (done) => {
      helpers.mocks.logs();

      const processor = createProcessor();
      processor.run((logs, cb) => cb(new Error('ERROR')))
        .then((result) => {
          expect(result).to.be.an('object');
          expect(result.status).to.be.an('object');
          expect(result.status.error.length).to.be.equal(2);
          expect(result.status.error[1]).to.be.an.instanceof(Error, /ERROR/);
          expect(result.status.logsProcessed).to.equal(0);
          expect(result.checkpoint).to.equal('100');
          done();
        });
    });

    it('should process large batch of logs', (done) => {
      helpers.mocks.logs({ times: 6 });

      let logsReceivedRuns = 0;
      const onLogsReceived = (logs, cb) => setTimeout(() => {
        logsReceivedRuns++;
        return cb();
      });

      const processor = createProcessor(null, { batchSize: 1000 });
      processor.run(onLogsReceived)
        .then((result) => {
          expect(logsReceivedRuns).to.equal(1);
          expect(result).to.be.an('object');
          expect(result.status).to.be.an('object');
          expect(result.status.logsProcessed).to.equal(500);
          expect(result.checkpoint).to.equal('500');
          done();
        });
    });

    it('should add warning if logs are outdated', (done) => {
      helpers.mocks.logs({ outdated: true });
      helpers.mocks.logs({ empty: true });

      const processor = createProcessor();
      processor.run((logs, cb) => setTimeout(() => cb()))
        .then((result) => {
          expect(result).to.be.an('object');
          expect(result.status).to.be.an('object');
          expect(result.status.warning).to.be.a('string');
          expect(result.status.logsProcessed).to.equal(100);
          expect(result.checkpoint).to.equal('100');
          done();
        });
    });

    it('shouldn\'t write anything to storage, if no logs processed', (done) => {
      helpers.mocks.logs({ empty: true });

      const processor = createProcessor();
      processor.run((logs, cb) => setTimeout(() => cb()))
        .then((result) => {
          expect(result).to.be.an('object');
          expect(result.status).to.be.an('object');
          expect(result.status.logsProcessed).to.equal(0);
          expect(result.checkpoint).to.equal(null);
          done();
        });
    });

    it('should done by error in onLogsReceived', (done) => {
      helpers.mocks.logs({ empty: true });

      const processor = createProcessor();
      processor.run((logs, cb) => cb(new Error('ERROR')))
        .then((result) => {
          expect(result).to.be.an('object');
          expect(result.status).to.be.an('object');
          expect(result.status.logsProcessed).to.equal(0);
          expect(result.checkpoint).to.equal(null);
          done();
        });
    });

    it('should work with logLevel', (done) => {
      helpers.mocks.logs({ times: 6 });

      const processor = createProcessor(null, { logLevel: 1 });
      processor.run((logs, cb) => cb())
        .then((result) => {
          expect(result).to.be.an('object');
          expect(result.status).to.be.an('object');
          expect(result.status.logsProcessed).to.equal(500);
          expect(result.checkpoint).to.equal('500');
          done();
        });
    });
  });
});
