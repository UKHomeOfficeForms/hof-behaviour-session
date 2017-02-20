'use strict';

const SessionsBehaviour = require('../');
const Controller = require('hof-form-controller');
const Model = require('hof-model');
const request = require('reqres').req;
const response = require('reqres').res;
const Sessions = SessionsBehaviour(Controller);

describe('Sessions Behaviour', () => {
  let sessions;
  let req;
  let res;
  let next;

  beforeEach(done => {
    req = request({
        sessionModel: new Model()
    });
    res = response();
    next = sinon.stub();
    sessions = new Sessions({
      template: 'index',
      fields: {
        field1: {},
        field2: {}
      }
    });
    sessions._configure(req, res, done);
  });

  describe('getValues', () => {
    beforeEach(() => {
      sinon.stub(Controller.prototype, 'getValues').yields();
    });

    afterEach(() => {
      Controller.prototype.getValues.restore();
    });

    it('calls super', () => {
      sessions.getValues(req, res, next);
      Controller.prototype.getValues.should.have.been.calledOnce;
    });

    it('calls callback with an error if super throws', () => {
      const err = new Error('Oops');
      Controller.prototype.getValues.yields(err);
      sessions.getValues(req, res, next);
      next.should.have.been.calledWith(err);
    });

    it('extends the values returned by super with sessionModel values, and errorValues', () => {
      req.sessionModel.set({
        foo: 'bar',
        bar: 'baz',
        errorValues: {
          bar: 'something else'
        }
      });
      Controller.prototype.getValues.yields(null, {
        a: 'b'
      });
      sessions.getValues(req, res, next);
      next.should.have.been.calledWithExactly(null, {
        foo: 'bar',
        bar: 'something else',
        a: 'b'
      });
    });
  });

  describe('configure', () => {
    it('throws an error if req.sessionModel hasn\'t been set', () => {
      expect(() => {
        sessions.configure({}, res, () => {});
      }).to.throw();
    });
  });

  describe('getErrors', () => {
    it('only returns errors from fields relevant to the current step', () => {
      req.sessionModel.set('errors', {
        field1: 'foo',
        field3: 'bar'
      });
      const errors = sessions.getErrors(req, res);
      errors.should.eql({ field1: 'foo' });
    });

    it('does not return errors with a redirect property', () => {
      req.sessionModel.set('errors', {
        field1: {
          redirect: '/exit-page'
        },
        field2: {
          message: 'message'
        }
      });
      const errors = sessions.getErrors(req, res);
      errors.should.eql({ field2: { message: 'message' } });
    });

    it('includes errors on dynamically created fields', () => {
      req.sessionModel.set('errors', {
        field1: 'foo',
        field3: 'bar'
      });
      req.form.options.fields.field3 = {};
      const errors = sessions.getErrors(req, res);
      errors.should.eql({ field1: 'foo', field3: 'bar' });
    });
  });

  describe('errorHandler', () => {
    beforeEach(() => {
      sinon.stub(Controller.prototype, 'errorHandler');
      sinon.stub(Sessions.prototype, 'missingPrereqHandler');
    });

    afterEach(() => {
      Controller.prototype.errorHandler.restore();
      Sessions.prototype.missingPrereqHandler.restore();
    });

    it('calls missingPrereqHandler for missing prerquisite errors', () => {
      const err = new Error('foo');
      err.code = 'MISSING_PREREQ';
      sessions.errorHandler(err, req, res, next);
      sessions.missingPrereqHandler.should.have.been.calledWithExactly(req, res, next);
    });

    it('passes through to parent errorHandler for all other errors', () => {
      const err = new Error('foo');
      sessions.errorHandler(err, req, res, next);
      Controller.prototype.errorHandler.should.have.been.calledWithExactly(err, req, res, next);
      Controller.prototype.errorHandler.should.have.been.calledOn(sessions);
    });
  });

  describe('missingPrereqHandler', () => {
    beforeEach(() => {
      sessions.options.steps = {
        '/one': { next: '/two' },
        '/two': { next: '/three' },
        '/three': { next: '/four' },
        '/four': {}
      };
    });

    it('redirects to the step following the most recently completed', () => {
      req.sessionModel.set('steps', ['/one']);
      sessions.missingPrereqHandler(req, res, next);
      res.redirect.should.have.been.calledWith('/two');
    });

    it('redirects to the first step if no steps have been completed', () => {
      req.sessionModel.set('steps', []);
      sessions.missingPrereqHandler(req, res, next);
      res.redirect.should.have.been.calledWith('/one');
    });
  });
});
