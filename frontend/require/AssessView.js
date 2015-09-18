
define(['underscore', 'backbone', 'mustache', 'moment-timezone', 'renderer', 'TestFactory', 'text!AssessView.html'], function(_, Backbone, Mustache, moment, renderer, TestFactory, AssessViewTemplate) {

    var AssessView = Backbone.View.extend({

        tagName: 'div',

        events: {
            "click .generateVersion": "generateVersion",
        },

        initialize: function() {
            this.appModel = this.options.appModel;
            this.router = this.options.router;
            this.tests = this.options.tests;
            this.tInstances = this.options.tInstances;
            this.listenTo(this.tInstances, "all", this.render);
            this.listenTo(this.tests, "all", this.render);
        },

        render: function() {
            var that = this;
            var data = {};
            data.setList = [];
            data.confirmGenerateVersionList = [];
            var sets = _(this.tests.pluck("set")).uniq().sort();
            _(sets).each(function(set) {
                var setData = {
                    title: set,
                    assessList: [],
                };
                var theseTests = new Backbone.Collection(that.tests.where({set: set}));
                theseTests = new Backbone.Collection(theseTests.sortBy("number"));
                theseTests.each(function(test) {
                    var tid = test.get("tid");
                    var testTitle = set + ' ' + test.get("number") + ': ' + test.get("title");
                    var options = test.get("options");
                    var testAdmin = null;
                    if (that.appModel.hasPermission("seeAdminPages")) {
                        testAdmin = '<a href="#t/' + tid + '" class="btn btn-info btn-xs">Admin</a>';
                    }
                    if (options && !options.autoCreate) {
                        var assess = {
                            title: testTitle,
                            extra: '<button class="btn btn-primary btn-xs" data-toggle="modal" data-target="#confirmGenerateVersionModal-' + tid + '">New version</button>',
                            admin: testAdmin,
                        };
                        setData.assessList.push(assess);

                        var confirmGenerateVersion = {
                            tid: tid,
                            title: testTitle,
                        };
                        data.confirmGenerateVersionList.push(confirmGenerateVersion);
                    }
                    
                    var theseTInstances = new Backbone.Collection(that.tInstances.where({tid: tid}));
                    theseTInstances = new Backbone.Collection(theseTInstances.sortBy("number"));
                    theseTInstances.each(function(tInstance) {
                        var tiid = tInstance.get("tiid");
                        var title = testTitle;
                        var admin = testAdmin;
                        if (options && !options.autoCreate) {
                            title = testTitle + ' #' + tInstance.get("number");
                            admin = null;
                        }
                        var score = Math.round(tInstance.get("score") / test.get("maxScore") * 100);
                        var remScore = 100 - score;
                        var scoreHTML;
                        if (tInstance.has("open") && tInstance.get("open")) {
                            scoreHTML = null;
                        } else if (score >= 50) {
                            scoreHTML = '<div class="progress" style="min-width: 5em">'
                                + '<div class="progress-bar progress-bar-success" style="width: ' + score + '%">' + score + '%</div>'
                                + '<div class="progress-bar progress-bar-danger" style="width: ' + remScore + '%"></div>'
                                + '</div>';
                        } else {
                            scoreHTML = '<div class="progress" style="min-width: 5em">'
                                + '<div class="progress-bar progress-bar-success" style="width: ' + score + '%"></div>'
                                + '<div class="progress-bar progress-bar-danger" style="width: ' + remScore + '%">' + score + '%</div>'
                                + '</div>';
                        }
                        var date = null;
                        var dateTooltip = null;
                        var highlightRow = false;
                        if (tInstance.has("open") && tInstance.get("open")) {
                            date = "in progress";
                            highlightRow = true;
                        } else if (test.has("dueDate")) {
                            date = that.appModel.formatDate(test.get("dueDate"));
                            dateTooltip = "Due date: " + that.appModel.formatDateLong(test.get("dueDate"));
                            if (moment(test.get("dueDate")).isAfter(moment())) {
                                highlightRow = true;
                            }
                        } else if (tInstance.has("finishDate")) {
                            date = that.appModel.formatDate(tInstance.get("finishDate"));
                            dateTooltip = "Completed date: " + that.appModel.formatDateLong(tInstance.get("finishDate"));
                        }
                        var assess = {
                            rowSpec: highlightRow ? 'class="warning"' : '',
                            admin: admin,
                            title: '<a href="#ti/' + tiid + '">' + title + '</a>',
                            score: scoreHTML,
                            date: date,
                            dateTooltip: dateTooltip,
                        };
                        setData.assessList.push(assess);
                    });
                });
                data.setList.push(setData);
            });

            data.testList = [];
            this.tests.each(function(test) {
                data.testList.push({
                    tid: test.get("tid")
                });
            });
            var html = Mustache.render(AssessViewTemplate, data);
            this.$el.html(html);
            $('[data-toggle=tooltip]').tooltip();
            
            this.subViews = [];
            this.tests.each(function(test) {
                var tid = test.get("tid");
                var TestView = TestFactory.getClass(test.get("type"), "testView");
                if (!TestView)
                    return;
                var subView = new TestView({model: test, appModel: that.appModel, tInstances: that.tInstances});
                var options = {
                    wait: true,
                    success: function(model, resp, options) {
                        var tiid = model.get("tiid");
                        that.router.navigate("ti/" + tiid, {trigger: true});
                    },
                };
                that.listenTo(subView, "createTestInstance", that.tInstances.create.bind(that.tInstances, {uid: that.appModel.get("userUID"), tid: tid}, options));
                that.subViews.push(subView);
                subView.render();
                that.$("#" + tid).html(subView.el);
            });
        },

        generateVersion: function(event) {
            var tid = event.target.id.slice(16); // strip off leading "generateVersion-"
            var that = this;
            this.$('#confirmGenerateVersionModal-' + tid).on('hidden.bs.modal', function (e) {
                var tInstance = {
                    uid: that.appModel.get("userUID"),
                    tid: tid,
                };
                var options = {
                    wait: true,
                };
                that.tInstances.create(tInstance, options);
            })
            this.$("#confirmGenerateVersionModal-" + tid).modal('hide');
        },
            
        close: function() {
            if (this.subViews) {
                _(this.subViews).each(function(subView) {
                    subView.close();
                });
            }
            this.remove();
        }
    });

    return AssessView;
});
