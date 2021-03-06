/*global describe, it, beforeEach, afterEach */
var should  = require('should'),
    sinon   = require('sinon'),
    rewire  = require('rewire'),
    Promise = require('bluebird'),

    // Stuff we are testing
    configUtils   = require('../utils/configUtils'),
    models        = require('../../server/models'),
    notifications = require('../../server/api/notifications'),
    versioning    = require('../../server/data/schema/versioning'),
    update        = rewire('../../server/data/migration/fixtures/update'),
    populate      = rewire('../../server/data/migration/fixtures/populate'),
    fixtureUtils  = require('../../server/data/migration/fixtures/utils'),
    fixtures004   = require('../../server/data/migration/fixtures/004'),
    fixtures005   = require('../../server/data/migration/fixtures/005'),
    ensureDefaultSettings = require('../../server/data/migration/fixtures/settings'),

    sandbox       = sinon.sandbox.create();

describe('Fixtures', function () {
    var loggerStub;

    beforeEach(function () {
        loggerStub = {
            info: sandbox.stub(),
            warn: sandbox.stub()
        };

        models.init();
    });

    afterEach(function () {
        sandbox.restore();
        configUtils.restore();
    });

    describe('Update fixtures', function () {
        it('should call `getUpdateFixturesTasks` when upgrading from 003 -> 004', function (done) {
            var getVersionTasksStub = sandbox.stub(versioning, 'getUpdateFixturesTasks').returns([]);

            update(['004'], loggerStub).then(function () {
                loggerStub.info.calledOnce.should.be.true();
                loggerStub.warn.called.should.be.false();
                getVersionTasksStub.calledOnce.should.be.true();
                done();
            }).catch(done);
        });

        it('should NOT call `getUpdateFixturesTasks` when upgrading from 004 -> 004', function (done) {
            var getVersionTasksStub = sandbox.stub(versioning, 'getUpdateFixturesTasks').returns([]);

            update([], loggerStub).then(function () {
                loggerStub.info.calledOnce.should.be.true();
                loggerStub.warn.called.should.be.false();
                getVersionTasksStub.calledOnce.should.be.false();
                done();
            }).catch(done);
        });

        it('should call tasks in correct order if provided', function (done) {
            var task1Stub = sandbox.stub().returns(Promise.resolve()),
                task2Stub = sandbox.stub().returns(Promise.resolve()),
                getVersionTasksStub = sandbox.stub(versioning, 'getUpdateFixturesTasks').returns([task1Stub, task2Stub]);

            update(['000'], loggerStub).then(function () {
                loggerStub.info.calledTwice.should.be.true();
                loggerStub.warn.called.should.be.false();
                getVersionTasksStub.calledOnce.should.be.true();
                task1Stub.calledOnce.should.be.true();
                task2Stub.calledOnce.should.be.true();
                done();
            }).catch(done);
        });

        describe('Update to 004', function () {
            it('should call all the 004 fixture upgrade tasks', function (done) {
                // Setup
                // Create a new stub, this will replace sequence, so that db calls don't actually get run
                var sequenceStub = sandbox.stub(),
                    sequenceReset = update.__set__('sequence', sequenceStub);

                // The first time we call sequence, it should be to execute a top level version, e.g 004
                // yieldsTo('0') means this stub will execute the function at index 0 of the array passed as the
                // first argument. In short the `runVersionTasks` function gets executed, and sequence gets called
                // again with the array of tasks to execute for 004, which is what we want to check
                sequenceStub.onFirstCall().yieldsTo('0').returns(Promise.resolve([]));

                update(['004'], loggerStub).then(function (result) {
                    should.exist(result);

                    loggerStub.info.calledTwice.should.be.true();
                    loggerStub.warn.called.should.be.false();

                    sequenceStub.calledTwice.should.be.true();

                    sequenceStub.firstCall.calledWith(sinon.match.array, sinon.match.object, loggerStub).should.be.true();
                    sequenceStub.firstCall.args[0].should.be.an.Array().with.lengthOf(1);
                    sequenceStub.firstCall.args[0][0].should.be.a.Function().with.property('name', 'runVersionTasks');

                    sequenceStub.secondCall.calledWith(sinon.match.array, sinon.match.object, loggerStub).should.be.true();
                    sequenceStub.secondCall.args[0].should.be.an.Array().with.lengthOf(8);
                    sequenceStub.secondCall.args[0][0].should.be.a.Function().with.property('name', 'moveJQuery');
                    sequenceStub.secondCall.args[0][1].should.be.a.Function().with.property('name', 'updatePrivateSetting');
                    sequenceStub.secondCall.args[0][2].should.be.a.Function().with.property('name', 'updatePasswordSetting');
                    sequenceStub.secondCall.args[0][3].should.be.a.Function().with.property('name', 'updateGhostAdminClient');
                    sequenceStub.secondCall.args[0][4].should.be.a.Function().with.property('name', 'addGhostFrontendClient');
                    sequenceStub.secondCall.args[0][5].should.be.a.Function().with.property('name', 'cleanBrokenTags');
                    sequenceStub.secondCall.args[0][6].should.be.a.Function().with.property('name', 'addPostTagOrder');
                    sequenceStub.secondCall.args[0][7].should.be.a.Function().with.property('name', 'addNewPostFixture');

                    // Reset
                    sequenceReset();
                    done();
                }).catch(done);
            });

            describe('Tasks:', function () {
                var getObjStub, settingsOneStub, settingsEditStub, clientOneStub, clientEditStub;

                beforeEach(function () {
                    getObjStub = {get: sandbox.stub()};
                    settingsOneStub = sandbox.stub(models.Settings, 'findOne').returns(Promise.resolve(getObjStub));
                    settingsEditStub = sandbox.stub(models.Settings, 'edit').returns(Promise.resolve());
                    clientOneStub = sandbox.stub(models.Client, 'findOne').returns(Promise.resolve(getObjStub));
                    clientEditStub = sandbox.stub(models.Client, 'edit').returns(Promise.resolve());
                });

                it('should have tasks for 004', function () {
                    should.exist(fixtures004);
                    fixtures004.should.be.an.Array().with.lengthOf(8);
                });

                describe('01-move-jquery-with-alert', function () {
                    it('tries to move jQuery to ghost_foot', function (done) {
                        getObjStub.get.returns('');

                        fixtures004[0]({}, loggerStub).then(function () {
                            settingsOneStub.calledOnce.should.be.true();
                            settingsOneStub.calledWith('ghost_foot').should.be.true();
                            settingsEditStub.calledOnce.should.be.true();
                            loggerStub.info.calledOnce.should.be.true();
                            loggerStub.warn.called.should.be.false();

                            done();
                        }).catch(done);
                    });

                    it('does not move jQuery to ghost_foot if it is already there', function (done) {
                        getObjStub.get.returns(
                            '<!-- You can safely delete this line if your theme does not require jQuery -->\n'
                            + '<script type="text/javascript" src="https://code.jquery.com/jquery-1.11.3.min.js"></script>\n\n'
                        );

                        fixtures004[0]({}, loggerStub).then(function () {
                            settingsOneStub.calledOnce.should.be.true();
                            settingsOneStub.calledWith('ghost_foot').should.be.true();
                            settingsEditStub.calledOnce.should.be.false();
                            loggerStub.info.called.should.be.false();
                            loggerStub.warn.calledOnce.should.be.true();

                            done();
                        }).catch(done);
                    });

                    it('does not move jQuery to ghost_foot if the setting is missing', function (done) {
                        settingsOneStub.returns(Promise.resolve());

                        fixtures004[0]({}, loggerStub).then(function () {
                            settingsOneStub.calledOnce.should.be.true();
                            settingsOneStub.calledWith('ghost_foot').should.be.true();
                            settingsEditStub.called.should.be.false();
                            loggerStub.info.called.should.be.false();
                            loggerStub.warn.calledOnce.should.be.true();

                            done();
                        }).catch(done);
                    });

                    it('tried to move jQuery AND add a privacy message if any privacy settings are on', function (done) {
                        var notificationsAddStub = sandbox.stub(notifications, 'add').returns(Promise.resolve());
                        configUtils.set({privacy: {useGoogleFonts: false}});
                        getObjStub.get.returns('');

                        fixtures004[0]({}, loggerStub).then(function () {
                            settingsOneStub.calledOnce.should.be.true();
                            settingsOneStub.calledWith('ghost_foot').should.be.true();
                            settingsEditStub.calledOnce.should.be.true();
                            notificationsAddStub.calledOnce.should.be.true();
                            loggerStub.info.calledTwice.should.be.true();
                            loggerStub.warn.called.should.be.false();

                            done();
                        }).catch(done);
                    });
                });

                describe('02-update-private-setting-type', function () {
                    it('tries to update setting type correctly', function (done) {
                        fixtures004[1]({}, loggerStub).then(function () {
                            settingsOneStub.calledOnce.should.be.true();
                            settingsOneStub.calledWith('isPrivate').should.be.true();
                            getObjStub.get.calledOnce.should.be.true();
                            getObjStub.get.calledWith('type').should.be.true();
                            settingsEditStub.calledOnce.should.be.true();
                            settingsEditStub.calledWith({key: 'isPrivate', type: 'private'}).should.be.true();
                            loggerStub.info.calledOnce.should.be.true();
                            loggerStub.warn.called.should.be.false();
                            sinon.assert.callOrder(settingsOneStub, getObjStub.get, loggerStub.info, settingsEditStub);

                            done();
                        }).catch(done);
                    });

                    it('does not try to update setting type if it is already set', function (done) {
                        getObjStub.get.returns('private');

                        fixtures004[1]({}, loggerStub).then(function () {
                            settingsOneStub.calledOnce.should.be.true();
                            settingsOneStub.calledWith('isPrivate').should.be.true();
                            getObjStub.get.calledOnce.should.be.true();
                            getObjStub.get.calledWith('type').should.be.true();

                            settingsEditStub.called.should.be.false();
                            loggerStub.info.called.should.be.false();
                            loggerStub.warn.calledOnce.should.be.true();

                            sinon.assert.callOrder(settingsOneStub, getObjStub.get, loggerStub.warn);

                            done();
                        }).catch(done);
                    });
                });

                describe('03-update-password-setting-type', function () {
                    it('tries to update setting type correctly', function (done) {
                        fixtures004[2]({}, loggerStub).then(function () {
                            settingsOneStub.calledOnce.should.be.true();
                            settingsOneStub.calledWith('password').should.be.true();
                            settingsEditStub.calledOnce.should.be.true();
                            settingsEditStub.calledWith({key: 'password', type: 'private'}).should.be.true();
                            loggerStub.info.calledOnce.should.be.true();
                            loggerStub.warn.called.should.be.false();
                            sinon.assert.callOrder(settingsOneStub, loggerStub.info, settingsEditStub);

                            done();
                        }).catch(done);
                    });

                    it('does not try to update setting type if it is already set', function (done) {
                        getObjStub.get.returns('private');

                        fixtures004[2]({}, loggerStub).then(function () {
                            settingsOneStub.calledOnce.should.be.true();
                            settingsOneStub.calledWith('password').should.be.true();
                            getObjStub.get.calledOnce.should.be.true();
                            getObjStub.get.calledWith('type').should.be.true();

                            settingsEditStub.called.should.be.false();
                            loggerStub.info.called.should.be.false();
                            loggerStub.warn.calledOnce.should.be.true();

                            sinon.assert.callOrder(settingsOneStub, getObjStub.get);

                            done();
                        }).catch(done);
                    });
                });

                describe('04-update-ghost-admin-client', function () {
                    it('tries to update client correctly', function (done) {
                        fixtures004[3]({}, loggerStub).then(function () {
                            clientOneStub.calledOnce.should.be.true();
                            clientOneStub.calledWith({slug: 'ghost-admin'}).should.be.true();
                            getObjStub.get.calledTwice.should.be.true();
                            getObjStub.get.calledWith('secret').should.be.true();
                            getObjStub.get.calledWith('status').should.be.true();
                            clientEditStub.calledOnce.should.be.true();
                            loggerStub.info.calledOnce.should.be.true();
                            loggerStub.warn.called.should.be.false();
                            sinon.assert.callOrder(
                                clientOneStub, getObjStub.get, getObjStub.get, loggerStub.info, clientEditStub
                            );

                            done();
                        }).catch(done);
                    });

                    it('does not try to update client if the secret and status are already correct', function (done) {
                        getObjStub.get.withArgs('secret').returns('abc');
                        getObjStub.get.withArgs('status').returns('enabled');

                        fixtures004[3]({}, loggerStub).then(function () {
                            clientOneStub.calledOnce.should.be.true();
                            clientOneStub.calledWith({slug: 'ghost-admin'}).should.be.true();
                            getObjStub.get.calledTwice.should.be.true();
                            getObjStub.get.calledWith('secret').should.be.true();
                            getObjStub.get.calledWith('status').should.be.true();
                            clientEditStub.called.should.be.false();
                            loggerStub.info.called.should.be.false();
                            loggerStub.warn.calledOnce.should.be.true();
                            sinon.assert.callOrder(clientOneStub, getObjStub.get, getObjStub.get, loggerStub.warn);

                            done();
                        }).catch(done);
                    });

                    it('tries to update client if secret is correct but status is wrong', function (done) {
                        getObjStub.get.withArgs('secret').returns('abc');
                        getObjStub.get.withArgs('status').returns('development');

                        fixtures004[3]({}, loggerStub).then(function () {
                            clientOneStub.calledOnce.should.be.true();
                            clientOneStub.calledWith({slug: 'ghost-admin'}).should.be.true();
                            getObjStub.get.calledTwice.should.be.true();
                            getObjStub.get.calledWith('secret').should.be.true();
                            getObjStub.get.calledWith('status').should.be.true();

                            clientEditStub.calledOnce.should.be.true();
                            loggerStub.info.calledOnce.should.be.true();
                            loggerStub.warn.called.should.be.false();
                            sinon.assert.callOrder(
                                clientOneStub, getObjStub.get, getObjStub.get, loggerStub.info, clientEditStub
                            );

                            done();
                        }).catch(done);
                    });

                    it('tries to update client if status is correct but secret is wrong', function (done) {
                        getObjStub.get.withArgs('secret').returns('not_available');
                        getObjStub.get.withArgs('status').returns('enabled');

                        fixtures004[3]({}, loggerStub).then(function () {
                            clientOneStub.calledOnce.should.be.true();
                            clientOneStub.calledWith({slug: 'ghost-admin'}).should.be.true();
                            getObjStub.get.calledOnce.should.be.true();
                            getObjStub.get.calledWith('secret').should.be.true();

                            clientEditStub.calledOnce.should.be.true();
                            loggerStub.info.calledOnce.should.be.true();
                            loggerStub.warn.called.should.be.false();
                            sinon.assert.callOrder(
                                clientOneStub, getObjStub.get, loggerStub.info, clientEditStub
                            );

                            done();
                        }).catch(done);
                    });
                });

                describe('05-add-ghost-frontend-client', function () {
                    it('tries to add client correctly', function (done) {
                        var clientAddStub = sandbox.stub(models.Client, 'add').returns(Promise.resolve());
                        clientOneStub.returns(Promise.resolve());

                        fixtures004[4]({}, loggerStub).then(function () {
                            clientOneStub.calledOnce.should.be.true();
                            clientOneStub.calledWith({slug: 'ghost-frontend'}).should.be.true();
                            clientAddStub.calledOnce.should.be.true();
                            loggerStub.info.calledOnce.should.be.true();
                            loggerStub.warn.called.should.be.false();
                            sinon.assert.callOrder(clientOneStub, loggerStub.info, clientAddStub);

                            done();
                        }).catch(done);
                    });

                    it('does not try to add client if it already exists', function (done) {
                        var clientAddStub = sandbox.stub(models.Client, 'add').returns(Promise.resolve());

                        fixtures004[4]({}, loggerStub).then(function () {
                            clientOneStub.calledOnce.should.be.true();
                            clientOneStub.calledWith({slug: 'ghost-frontend'}).should.be.true();
                            clientAddStub.called.should.be.false();
                            loggerStub.info.called.should.be.false();
                            loggerStub.warn.calledOnce.should.be.true();

                            done();
                        }).catch(done);
                    });
                });

                describe('06-clean-broken-tags', function () {
                    var tagObjStub, tagCollStub, tagAllStub;

                    beforeEach(function () {
                        tagObjStub = {
                            get: sandbox.stub(),
                            save: sandbox.stub().returns(Promise.resolve)
                        };
                        tagCollStub = {each: sandbox.stub().callsArgWith(0, tagObjStub)};
                        tagAllStub = sandbox.stub(models.Tag, 'findAll').returns(Promise.resolve(tagCollStub));
                    });

                    it('tries to clean broken tags correctly', function (done) {
                        tagObjStub.get.returns(',hello');

                        fixtures004[5]({}, loggerStub).then(function () {
                            tagAllStub.calledOnce.should.be.true();
                            tagCollStub.each.calledOnce.should.be.true();
                            tagObjStub.get.calledOnce.should.be.true();
                            tagObjStub.get.calledWith('name').should.be.true();
                            tagObjStub.save.calledOnce.should.be.true();
                            tagObjStub.save.calledWith({name: 'hello'}).should.be.true();
                            loggerStub.info.calledOnce.should.be.true();
                            loggerStub.warn.called.should.be.false();
                            sinon.assert.callOrder(tagAllStub, tagCollStub.each, tagObjStub.get, tagObjStub.save, loggerStub.info);

                            done();
                        }).catch(done);
                    });

                    it('tries can handle tags which end up empty', function (done) {
                        tagObjStub.get.returns(',');

                        fixtures004[5]({}, loggerStub).then(function () {
                            tagAllStub.calledOnce.should.be.true();
                            tagCollStub.each.calledOnce.should.be.true();
                            tagObjStub.get.calledOnce.should.be.true();
                            tagObjStub.get.calledWith('name').should.be.true();
                            tagObjStub.save.calledOnce.should.be.true();
                            tagObjStub.save.calledWith({name: 'tag'}).should.be.true();
                            loggerStub.info.calledOnce.should.be.true();
                            loggerStub.warn.called.should.be.false();
                            sinon.assert.callOrder(tagAllStub, tagCollStub.each, tagObjStub.get, tagObjStub.save, loggerStub.info);

                            done();
                        }).catch(done);
                    });

                    it('does not change tags if not necessary', function (done) {
                        tagObjStub.get.returns('hello');

                        fixtures004[5]({}, loggerStub).then(function () {
                            tagAllStub.calledOnce.should.be.true();
                            tagCollStub.each.calledOnce.should.be.true();
                            tagObjStub.get.calledOnce.should.be.true();
                            tagObjStub.get.calledWith('name').should.be.true();
                            tagObjStub.save.called.should.be.false();
                            loggerStub.info.called.should.be.false();
                            loggerStub.warn.calledOnce.should.be.true();
                            sinon.assert.callOrder(tagAllStub, tagCollStub.each, tagObjStub.get, loggerStub.warn);

                            done();
                        }).catch(done);
                    });

                    it('does nothing if there are no tags', function (done) {
                        tagAllStub.returns(Promise.resolve());

                        fixtures004[5]({}, loggerStub).then(function () {
                            tagAllStub.calledOnce.should.be.true();
                            tagCollStub.each.called.should.be.false();
                            tagObjStub.get.called.should.be.false();
                            tagObjStub.save.called.should.be.false();
                            loggerStub.info.called.should.be.false();
                            loggerStub.warn.calledOnce.should.be.true();
                            sinon.assert.callOrder(tagAllStub, loggerStub.warn);

                            done();
                        }).catch(done);
                    });
                });

                describe('07-add-post-tag-order', function () {
                    var tagOp1Stub, tagOp2Stub, tagObjStub, postObjStub, postCollStub, postAllStub;

                    beforeEach(function () {
                        tagOp1Stub = sandbox.stub().returns(Promise.resolve());
                        tagOp2Stub = sandbox.stub().returns(Promise.resolve());
                        tagObjStub = {
                            pivot: {get: sandbox.stub()}
                        };
                        postCollStub = {mapThen: sandbox.stub()};
                        postAllStub = sandbox.stub(models.Post, 'findAll').returns(Promise.resolve(postCollStub));

                        postObjStub = {
                            load: sandbox.stub(),
                            reduce: sandbox.stub(),
                            // By returning an array from related, we can use native reduce to simulate a result
                            related: sandbox.stub().returns([tagObjStub]),
                            // Get called when executing sequence
                            tags: sandbox.stub().returnsThis(),
                            updatePivot: sandbox.stub().returns(Promise.resolve())
                        };
                    });

                    it('calls load on each post', function (done) {
                        // Fake mapThen behaviour
                        postCollStub.mapThen.callsArgWith(0, postObjStub).returns([]);
                        fixtures004[6]({}, loggerStub).then(function () {
                            postAllStub.calledOnce.should.be.true();
                            postCollStub.mapThen.calledOnce.should.be.true();
                            postObjStub.load.calledOnce.should.be.true();
                            postObjStub.load.calledWith(['tags']).should.be.true();
                            loggerStub.info.calledOnce.should.be.true();
                            // gets called because we're stubbing to return an empty array
                            loggerStub.warn.calledOnce.should.be.true();
                            sinon.assert.callOrder(loggerStub.info, postAllStub, postCollStub.mapThen,  postObjStub.load);

                            done();
                        }).catch(done);
                    });

                    it('returns early, if no posts are found', function (done) {
                        // Fake mapThen behaviour
                        postCollStub.mapThen.returns([]);
                        postAllStub.returns(Promise.resolve());

                        fixtures004[6]({}, loggerStub).then(function () {
                            loggerStub.info.calledOnce.should.be.true();
                            loggerStub.warn.calledOnce.should.be.true();
                            postAllStub.calledOnce.should.be.true();
                            sinon.assert.callOrder(loggerStub.info, postAllStub, loggerStub.warn);

                            done();
                        }).catch(done);
                    });

                    it('executes sequence, if at least one tag is found', function (done) {
                        var tagOpStub = sandbox.stub().returns(Promise.resolve()),
                            tagOpsArr = [tagOpStub];

                        // By stubbing reduce, we can return an array directly without pretending to process tags
                        postObjStub.reduce.returns(tagOpsArr);
                        // By returning from mapThen, we can skip doing tag.load in this test
                        postCollStub.mapThen.returns(postObjStub);

                        fixtures004[6]({}, loggerStub).then(function () {
                            loggerStub.info.calledThrice.should.be.true();
                            loggerStub.warn.called.should.be.false();
                            postAllStub.calledOnce.should.be.true();
                            postCollStub.mapThen.calledOnce.should.be.true();
                            postObjStub.reduce.calledOnce.should.be.true();
                            tagOpStub.calledOnce.should.be.true();

                            sinon.assert.callOrder(
                                loggerStub.info, postAllStub, postCollStub.mapThen, postObjStub.reduce,
                                loggerStub.info, tagOpStub, loggerStub.info
                            );

                            done();
                        }).catch(done);
                    });

                    it('executes sequence, if more than one tag is found', function (done) {
                        var tagOpsArr = [tagOp1Stub, tagOp2Stub];
                        // By stubbing reduce, we can return an array directly without pretending to process tags
                        postObjStub.reduce.returns(tagOpsArr);
                        // By returning from mapThen, we can skip doing tag.load in this test
                        postCollStub.mapThen.returns(postObjStub);

                        fixtures004[6]({}, loggerStub).then(function () {
                            loggerStub.info.calledThrice.should.be.true();
                            loggerStub.warn.called.should.be.false();
                            postAllStub.calledOnce.should.be.true();
                            postCollStub.mapThen.calledOnce.should.be.true();
                            postObjStub.reduce.calledOnce.should.be.true();
                            tagOp1Stub.calledOnce.should.be.true();
                            tagOp2Stub.calledOnce.should.be.true();

                            sinon.assert.callOrder(
                                loggerStub.info, postAllStub, postCollStub.mapThen, postObjStub.reduce,
                                loggerStub.info, tagOp1Stub, tagOp2Stub, loggerStub.info
                            );

                            done();
                        }).catch(done);
                    });

                    it('does not execute sequence, if migrationHasRunFlag gets set to true', function (done) {
                        tagObjStub.pivot.get.returns(1);
                        // By returning from mapThen, we can skip doing tag.load in this test
                        postCollStub.mapThen.returns([postObjStub]);

                        fixtures004[6]({}, loggerStub).then(function () {
                            loggerStub.info.calledOnce.should.be.true();
                            loggerStub.warn.calledOnce.should.be.true();
                            postAllStub.calledOnce.should.be.true();
                            postCollStub.mapThen.calledOnce.should.be.true();
                            postObjStub.related.calledOnce.should.be.true();
                            tagObjStub.pivot.get.calledOnce.should.be.true();
                            tagObjStub.pivot.get.calledWith('sort_order').should.be.true();
                            sinon.assert.callOrder(
                                loggerStub.info, postAllStub, postCollStub.mapThen, postObjStub.related,
                                tagObjStub.pivot.get, loggerStub.warn
                            );

                            done();
                        }).catch(done);
                    });

                    it('does execute sequence, if migrationHasRunFlag is false', function (done) {
                        // If pivot gets a non-zero, migrationHasRunFlag gets set to true
                        tagObjStub.pivot.get.returns(0);
                        // By returning from mapThen, we can skip doing tag.load in this test
                        postCollStub.mapThen.returns([postObjStub]);

                        fixtures004[6]({}, loggerStub).then(function () {
                            loggerStub.info.calledThrice.should.be.true();
                            loggerStub.warn.called.should.be.false();
                            postAllStub.calledOnce.should.be.true();
                            postCollStub.mapThen.calledOnce.should.be.true();
                            postObjStub.related.calledOnce.should.be.true();
                            tagObjStub.pivot.get.calledOnce.should.be.true();
                            tagObjStub.pivot.get.calledWith('sort_order').should.be.true();

                            postObjStub.tags.calledOnce.should.be.true();
                            postObjStub.updatePivot.calledOnce.should.be.true();
                            sinon.assert.callOrder(
                                loggerStub.info, postAllStub, postCollStub.mapThen, postObjStub.related, tagObjStub.pivot.get,
                                loggerStub.info, postObjStub.tags, postObjStub.updatePivot, loggerStub.info
                            );

                            done();
                        }).catch(done);
                    });

                    it('tries to add incremental sort_order to posts_tags', function (done) {
                        // If pivot gets a non-zero, migrationHasRunFlag gets set to true
                        tagObjStub.pivot.get.returns(0);
                        // By returning an array from related, we can use real reduce to simulate a result here
                        postObjStub.related.returns([tagObjStub, tagObjStub, tagObjStub]);
                        // By returning from mapThen, we can skip doing tag.load in this test
                        postCollStub.mapThen.returns([postObjStub]);

                        fixtures004[6]({}, loggerStub).then(function () {
                            loggerStub.info.calledThrice.should.be.true();
                            loggerStub.warn.called.should.be.false();
                            postAllStub.calledOnce.should.be.true();
                            postCollStub.mapThen.calledOnce.should.be.true();
                            postObjStub.related.calledOnce.should.be.true();
                            tagObjStub.pivot.get.calledThrice.should.be.true();

                            postObjStub.tags.calledThrice.should.be.true();
                            postObjStub.updatePivot.calledThrice.should.be.true();

                            postObjStub.updatePivot.firstCall.args[0].should.eql({sort_order: 0});
                            postObjStub.updatePivot.secondCall.args[0].should.eql({sort_order: 1});
                            postObjStub.updatePivot.thirdCall.args[0].should.eql({sort_order: 2});

                            sinon.assert.callOrder(
                                loggerStub.info, postAllStub, postCollStub.mapThen, postObjStub.related,
                                tagObjStub.pivot.get, tagObjStub.pivot.get, tagObjStub.pivot.get,
                                loggerStub.info,
                                postObjStub.tags, postObjStub.updatePivot,
                                postObjStub.tags, postObjStub.updatePivot,
                                postObjStub.tags, postObjStub.updatePivot,
                                loggerStub.info
                            );

                            done();
                        }).catch(done);
                    });
                });

                describe('08-add-post-fixture', function () {
                    var postOneStub, postAddStub;

                    beforeEach(function () {
                        postOneStub = sandbox.stub(models.Post, 'findOne').returns(Promise.resolve());
                        postAddStub = sandbox.stub(models.Post, 'add').returns(Promise.resolve());
                    });

                    it('tries to add a new post fixture correctly', function (done) {
                        fixtures004[7]({}, loggerStub).then(function () {
                            postOneStub.calledOnce.should.be.true();
                            loggerStub.info.calledOnce.should.be.true();
                            loggerStub.warn.called.should.be.false();
                            postAddStub.calledOnce.should.be.true();
                            sinon.assert.callOrder(postOneStub, loggerStub.info, postAddStub);

                            done();
                        }).catch(done);
                    });

                    it('does not try to add new post fixture if it already exists', function (done) {
                        postOneStub.returns(Promise.resolve({}));

                        fixtures004[7]({}, loggerStub).then(function () {
                            postOneStub.calledOnce.should.be.true();
                            loggerStub.info.called.should.be.false();
                            loggerStub.warn.calledOnce.should.be.true();
                            postAddStub.called.should.be.false();

                            sinon.assert.callOrder(postOneStub, loggerStub.warn);

                            done();
                        }).catch(done);
                    });
                });
            });
        });

        describe('Update to 005', function () {
            it('should call all the 005 fixture upgrades', function (done) {
                // Setup
                // Create a new stub, this will replace sequence, so that db calls don't actually get run
                var sequenceStub = sandbox.stub(),
                    sequenceReset = update.__set__('sequence', sequenceStub);

                // The first time we call sequence, it should be to execute a top level version, e.g 005
                // yieldsTo('0') means this stub will execute the function at index 0 of the array passed as the
                // first argument. In short the `runVersionTasks` function gets executed, and sequence gets called
                // again with the array of tasks to execute for 005, which is what we want to check
                sequenceStub.onFirstCall().yieldsTo('0').returns(Promise.resolve([]));

                update(['005'], loggerStub).then(function (result) {
                    should.exist(result);

                    loggerStub.info.calledTwice.should.be.true();
                    loggerStub.warn.called.should.be.false();

                    sequenceStub.calledTwice.should.be.true();

                    sequenceStub.firstCall.calledWith(sinon.match.array, sinon.match.object, loggerStub).should.be.true();
                    sequenceStub.firstCall.args[0].should.be.an.Array().with.lengthOf(1);
                    sequenceStub.firstCall.args[0][0].should.be.a.Function().with.property('name', 'runVersionTasks');

                    sequenceStub.secondCall.calledWith(sinon.match.array, sinon.match.object, loggerStub).should.be.true();
                    sequenceStub.secondCall.args[0].should.be.an.Array().with.lengthOf(3);
                    sequenceStub.secondCall.args[0][0].should.be.a.Function().with.property('name', 'updateGhostClientsSecrets');
                    sequenceStub.secondCall.args[0][1].should.be.a.Function().with.property('name', 'addGhostFrontendClient');
                    sequenceStub.secondCall.args[0][2].should.be.a.Function().with.property('name', 'addClientPermissions');

                    // Reset
                    sequenceReset();
                    done();
                }).catch(done);
            });

            describe('Tasks:', function () {
                it('should have tasks for 005', function () {
                    should.exist(fixtures005);
                    fixtures005.should.be.an.Array().with.lengthOf(3);
                });

                describe('01-update-ghost-client-secrets', function () {
                    var queryStub, clientForgeStub, clientEditStub;

                    beforeEach(function () {
                        queryStub = {
                            query: sandbox.stub().returnsThis(),
                            fetch: sandbox.stub()
                        };

                        clientForgeStub = sandbox.stub(models.Clients, 'forge').returns(queryStub);
                        clientEditStub = sandbox.stub(models.Client, 'edit');
                    });

                    it('should do nothing if there are no incorrect secrets', function (done) {
                        // Setup
                        queryStub.fetch.returns(new Promise.resolve({models: []}));

                        // Execute
                        fixtures005[0]({}, loggerStub).then(function () {
                            clientForgeStub.calledOnce.should.be.true();
                            clientEditStub.called.should.be.false();
                            loggerStub.info.called.should.be.false();
                            loggerStub.warn.calledOnce.should.be.true();
                            done();
                        }).catch(done);
                    });

                    it('should try to fix any incorrect secrets', function (done) {
                        // Setup
                        queryStub.fetch.returns(new Promise.resolve({models: [{id: 1}]}));

                        // Execute
                        fixtures005[0]({}, loggerStub).then(function () {
                            clientForgeStub.calledOnce.should.be.true();
                            clientEditStub.called.should.be.true();
                            loggerStub.info.calledOnce.should.be.true();
                            loggerStub.warn.called.should.be.false();
                            done();
                        }).catch(done);
                    });
                });

                describe('02-add-ghost-scheduler-client', function () {
                    var clientOneStub;

                    beforeEach(function () {
                        clientOneStub = sandbox.stub(models.Client, 'findOne').returns(Promise.resolve({}));
                    });

                    it('tries to add client correctly', function (done) {
                        var clientAddStub = sandbox.stub(models.Client, 'add').returns(Promise.resolve());
                        clientOneStub.returns(Promise.resolve());

                        fixtures005[1]({}, loggerStub).then(function () {
                            clientOneStub.calledOnce.should.be.true();
                            clientOneStub.calledWith({slug: 'ghost-scheduler'}).should.be.true();
                            clientAddStub.calledOnce.should.be.true();
                            loggerStub.info.calledOnce.should.be.true();
                            loggerStub.warn.called.should.be.false();
                            sinon.assert.callOrder(clientOneStub, loggerStub.info, clientAddStub);

                            done();
                        }).catch(done);
                    });

                    it('does not try to add client if it already exists', function (done) {
                        var clientAddStub = sandbox.stub(models.Client, 'add').returns(Promise.resolve());

                        fixtures005[1]({}, loggerStub).then(function () {
                            clientOneStub.calledOnce.should.be.true();
                            clientOneStub.calledWith({slug: 'ghost-scheduler'}).should.be.true();
                            clientAddStub.called.should.be.false();
                            loggerStub.info.called.should.be.false();
                            loggerStub.warn.calledOnce.should.be.true();

                            done();
                        }).catch(done);
                    });
                });

                describe('03-add-client-permissions', function () {
                    var modelResult, addModelStub, relationResult, addRelationStub;

                    beforeEach(function () {
                        modelResult = {expected: 1, done: 1};
                        addModelStub = sandbox.stub(fixtureUtils, 'addFixturesForModel')
                            .returns(Promise.resolve(modelResult));

                        relationResult = {expected: 1, done: 1};
                        addRelationStub = sandbox.stub(fixtureUtils, 'addFixturesForRelation')
                            .returns(Promise.resolve(relationResult));
                    });

                    it('should find the correct model & relation to add', function (done) {
                        // Execute
                        fixtures005[2]({}, loggerStub).then(function () {
                            addModelStub.calledOnce.should.be.true();
                            addModelStub.calledWith(
                                fixtureUtils.findModelFixtures('Permission', {object_type: 'client'})
                            ).should.be.true();

                            addRelationStub.calledOnce.should.be.true();
                            addRelationStub.calledWith(
                                fixtureUtils.findPermissionRelationsForObject('client')
                            ).should.be.true();

                            loggerStub.info.calledTwice.should.be.true();
                            loggerStub.warn.called.should.be.false();

                            done();
                        });
                    });

                    it('should warn the result shows less work was done than expected', function (done) {
                        // Setup
                        modelResult.expected = 3;
                        // Execute
                        fixtures005[2]({}, loggerStub).then(function () {
                            addModelStub.calledOnce.should.be.true();
                            addModelStub.calledWith(
                                fixtureUtils.findModelFixtures('Permission', {object_type: 'client'})
                            ).should.be.true();

                            addRelationStub.calledOnce.should.be.true();
                            addRelationStub.calledWith(
                                fixtureUtils.findPermissionRelationsForObject('client')
                            ).should.be.true();

                            loggerStub.info.calledOnce.should.be.true();
                            loggerStub.warn.calledOnce.should.be.true();

                            done();
                        });
                    });
                });
            });
        });
    });

    describe('Populate fixtures', function () {
        // This tests that all the models & relations get called correctly
        it('should call all the fixture populations', function (done) {
            // Stub all the model methods so that nothing happens
            var postAddStub = sandbox.stub(models.Post, 'add').returns(Promise.resolve()),
                tagAddStub = sandbox.stub(models.Tag, 'add').returns(Promise.resolve()),
                roleAddStub = sandbox.stub(models.Role, 'add').returns(Promise.resolve()),
                clientAddStub = sandbox.stub(models.Client, 'add').returns(Promise.resolve()),
                permsAddStub = sandbox.stub(models.Permission, 'add').returns(Promise.resolve()),

            // Existence checks
                postOneStub = sandbox.stub(models.Post, 'findOne').returns(Promise.resolve()),
                tagOneStub = sandbox.stub(models.Tag, 'findOne').returns(Promise.resolve()),
                roleOneStub = sandbox.stub(models.Role, 'findOne').returns(Promise.resolve()),
                clientOneStub = sandbox.stub(models.Client, 'findOne').returns(Promise.resolve()),
                permOneStub = sandbox.stub(models.Permission, 'findOne').returns(Promise.resolve()),

            // Relations
                fromItem = {
                    related: sandbox.stub().returnsThis(),
                    findWhere: sandbox.stub().returns({})
                },
                toItem = [{get: sandbox.stub()}],
                modelMethodStub = {filter: sandbox.stub().returns(toItem), find: sandbox.stub().returns(fromItem)},
                permsAllStub = sandbox.stub(models.Permission, 'findAll').returns(Promise.resolve(modelMethodStub)),
                rolesAllStub = sandbox.stub(models.Role, 'findAll').returns(Promise.resolve(modelMethodStub)),
                postsAllStub = sandbox.stub(models.Post, 'findAll').returns(Promise.resolve(modelMethodStub)),
                tagsAllStub = sandbox.stub(models.Tag, 'findAll').returns(Promise.resolve(modelMethodStub)),

            // Create Owner
                userAddStub = sandbox.stub(models.User, 'add').returns(Promise.resolve({}));
            roleOneStub.onCall(4).returns(Promise.resolve({id: 1}));

            populate(loggerStub).then(function () {
                loggerStub.info.calledTwice.should.be.true();
                loggerStub.warn.called.should.be.false();

                postOneStub.calledOnce.should.be.true();
                postAddStub.calledOnce.should.be.true();
                tagOneStub.calledOnce.should.be.true();
                tagAddStub.calledOnce.should.be.true();
                roleOneStub.callCount.should.be.aboveOrEqual(4);
                roleAddStub.callCount.should.eql(4);
                clientOneStub.calledThrice.should.be.true();
                clientAddStub.calledThrice.should.be.true();

                permOneStub.callCount.should.eql(35);
                permsAddStub.called.should.be.true();
                permsAddStub.callCount.should.eql(35);

                permsAllStub.calledOnce.should.be.true();
                rolesAllStub.calledOnce.should.be.true();
                postsAllStub.calledOnce.should.be.true();
                tagsAllStub.calledOnce.should.be.true();

                // Relations
                modelMethodStub.filter.called.should.be.true();
                // 25 permissions, 1 tag
                modelMethodStub.filter.callCount.should.eql(25 + 1);
                modelMethodStub.find.called.should.be.true();
                // 3 roles, 1 post
                modelMethodStub.find.callCount.should.eql(3 + 1);

                // Create Owner
                roleOneStub.callCount.should.eql(5);
                userAddStub.calledOnce.should.be.true();

                done();
            }).catch(done);
        });

        describe('Create Owner', function () {
            var createOwner = populate.__get__('createOwner'),
                roleOneStub, userAddStub;

            beforeEach(function () {
                roleOneStub = sandbox.stub(models.Role, 'findOne');
                userAddStub = sandbox.stub(models.User, 'add');
            });

            it('createOwner will add user if owner role is present', function (done) {
                roleOneStub.returns(Promise.resolve({id: 1}));
                userAddStub.returns(Promise.resolve({}));

                createOwner(loggerStub).then(function () {
                    loggerStub.info.called.should.be.true();
                    loggerStub.warn.called.should.be.false();
                    roleOneStub.calledOnce.should.be.true();
                    userAddStub.called.should.be.true();

                    done();
                }).catch(done);
            });

            it('createOwner does not add user if owner role is not present', function (done) {
                roleOneStub.returns(Promise.resolve());
                userAddStub.returns(Promise.resolve({}));

                createOwner().then(function () {
                    roleOneStub.calledOnce.should.be.true();
                    userAddStub.called.should.be.false();

                    done();
                }).catch(done);
            });
        });
    });

    describe('Ensure default settings', function () {
        it('should call populate settings and provide messaging', function (done) {
            var settingsStub = sandbox.stub(models.Settings, 'populateDefaults').returns(new Promise.resolve());

            ensureDefaultSettings(loggerStub).then(function () {
                settingsStub.calledOnce.should.be.true();
                loggerStub.info.calledOnce.should.be.true();

                done();
            }).catch(done);
        });
    });
});
