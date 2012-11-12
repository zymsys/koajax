(function () {
    var hasRun;
    if (!window.require) {
        window.require = function (dependencies, callback) {
            if (!hasRun) {
                hasRun = true;
                callback(undefined, ko, undefined, $);
            }
        }
    } else {
        requirejs.config({
            baseUrl: '../scripts/3rdparty',
            paths: {
                'koajax': '../koajax-0.0.1',
                'knockout': 'knockout-2.2.0.debug'
            }
        });
    }
})();
require(['qunit-1.10.0','knockout','koajax','jquery-1.8.2.min'], function (qunit, ko, koajax, $) {
    $ = jQuery;
    var mockAjax = true;
    var subscriptions = [];
    if (mockAjax) {
        $.ajax = function (url, options) {
            var data;
            function success(data) {
                setTimeout(function () {
                    console.log(data);
                    options.success(data);
                },10);
            }
            switch (url) {
                case '/server/hello.php':
                    success('Hello World!');
                    break;
                case '/server/echo.php':
                    success({response: options.data.send});
                    break;
                case '/server/deep.php':
                    data = JSON.parse(options.data);
                    success({
                        components: {
                            first: data.name.first,
                            last: data.name.last
                        },
                        calculated: {
                            fullName: data.name.first + ' ' + data.name.last
                        }
                    });
                    break;
                case '/server/double.php':
                    success(options.data.text.toString() + options.data.text.toString());
                    break;
                case '/server/explode.php':
                    data = options.data.text.split(',');
                    success({parts: data.map(function (item) { return {value: item}; })});
                    break;
                case '/server/implode.php':
                    data = options.data.text.map(function (item) { return item.value; });
                    success(data.join(','));
                    break;
                case '/server/array.php':
                    success({ ghostbusters: [
                        "Peter Venkman",
                        "Ray Stantz",
                        "Egon Spengler",
                        "Winston Zeddemore"
                    ]});
                    break;
                case '/server/error.php':
                    options.error();
                    break;
                case '/server/ucase.php':
                    data = JSON.parse(options.data);
                    (function () {
                        var p = data.people,
                            i, j, result = [];
                        for (i = 0, j = p.length; i < j; i += 1) {
                            result.push({
                                'first': p[i].first[0].toUpperCase() + p[i].first.substring(1),
                                'last': p[i].last[0].toUpperCase() + p[i].last.substring(1)
                            });
                        }
                        success({people:result});
                    })();
                    break;
                case '/send':
                    for (var index in subscriptions) {
                        var subscription = subscriptions[index];
                        subscription.success({
                            receivedFrom: options.data.from,
                            receivedMessage: options.data.message
                        });
                        success({status:'ok'});
                    }
                    break;
                case '/receive':
                    subscriptions.push(options);
                    break;
            }
        };
    }
    test("Knockout.JS AJAX Exists", function () {
        ok(ko, "Knockout.JS is loaded");
        ok(ko.ajax, "AJAX object exists and is 'truthy'.");
    });
    test("Simplest Request", function () {
        var viewModel = {
            "sayHello": ko.observable(false),
            "helloMessage": ko.observable()
        };
        var endpoint = "/server/hello.php";
        var responseCount = 0;
        ko.applyBindings(viewModel);
        deepEqual(undefined, viewModel.helloMessage(), "Hello message starts out undefined");
        stop();
        var helloTestCallback = function (endpointName) {
            responseCount+=1;
            equal("Hello World!", viewModel.helloMessage(), "Hello service responded with the expected message");
            equal(false, viewModel.sayHello(), "Trigger is cleared back to false after response");
            ok(responseCount <= 2, "No more than two responses are received");
            if (responseCount == 1) {
                viewModel.sayHello(true);
            }
            if (responseCount == 2) {
                //Never unregister this callback - we want to detect extra responses if they're sent.
                start();
            }
        };
        ko.ajax.registerCallback(endpoint, 'success', helloTestCallback);
        viewModel.sayHello(true);
    });
    test("Echo Request", function () {
        var message = "One ping, and one ping only";
        var viewModel = {
            "sendPing": ko.observable(false),
            "ping": ko.observable(message),
            "pong": ko.observable()
        };
        var endpoint = "/server/echo.php";
        ko.applyBindings(viewModel);
        deepEqual(undefined, viewModel.pong(), "Pong starts out undefined");
        stop();
        var echoTestCallback = function (endpointName) {
            equal(message, viewModel.pong(), "Echo service responded with the expected response");
            ko.ajax.unregisterCallback(endpoint, 'success', echoTestCallback);
            start();
        };
        ko.ajax.registerCallback(endpoint, 'success', echoTestCallback);
        viewModel.sendPing(true);
    });
    test("Before Request", function () {
        var originalMessage = "One ping, and one ping only";
        var tweakedMessage = "Kilroy was here";
        var viewModel = {
            "sendPing": ko.observable(false),
            "ping": ko.observable(originalMessage),
            "pong": ko.observable()
        };
        var endpoint = "/server/echo.php";
        ko.applyBindings(viewModel);
        deepEqual(undefined, viewModel.pong(), "Pong starts out undefined");
        stop();
        var beforeTestCallback = function (endpointName, requestData, executeRequest) {
            requestData.data.send = tweakedMessage;
            equal(endpointName, "/server/echo.php", "Before request callback execute with correct endpoint name");
            if (executeRequest) {
                executeRequest();
                return true;
            }
        };
        var echoTestCallback = function (endpointName) {
            equal(tweakedMessage, viewModel.pong(), "Echo service responded with the tweaked response");
            ko.ajax.unregisterCallback(endpoint, 'before', beforeTestCallback);
            ko.ajax.unregisterCallback(endpoint, 'success', echoTestCallback);
            start();
        };
        ko.ajax.registerCallback(endpoint, 'before', beforeTestCallback);
        ko.ajax.registerCallback(endpoint, 'success', echoTestCallback);
        viewModel.sendPing(true);
    });
    test("Deep Request", function () {
        var first = "Alfred";
        var last = "Newman";
        var viewModel = {
            inputFields: {
                first: ko.observable(first),
                last: ko.observable(last)
            },
            outputFields: {
                fullName: ko.observable()
            },
            triggers: {
                sendName: ko.observable(false)
            }
        };
        var endpoint = "/server/deep.php";
        ko.applyBindings(viewModel);
        deepEqual(undefined, viewModel.outputFields.fullName(), "Full name starts out undefined");
        stop();
        var deepTestCallback = function (endpointName) {
            equal(first + ' ' + last, viewModel.outputFields.fullName(), "Name constructed as expected");
            ko.ajax.unregisterCallback(endpoint, 'success', deepTestCallback);
            start();
        };
        ko.ajax.registerCallback(endpoint, 'success', deepTestCallback);
        viewModel.triggers.sendName(true);
    });
    test("Array Request", function () {
        var viewModel = {
            callGhostbusters: ko.observable(false),
            ghostbusters: ko.observableArray([])
        };
        var endpoint = "/server/array.php";
        ko.applyBindings(viewModel);
        equal(0, viewModel.ghostbusters().length, "Start with no Ghostbusters");
        stop();
        var arrayTestCallback = function (endpointName) {
            var ghostbusters = viewModel.ghostbusters();
            equal(4, ghostbusters.length, "End up with four Ghostbusters");
            equal('Peter Venkman', ghostbusters[0], "First Ghostbuster is Peter");
            equal('Ray Stantz', ghostbusters[1], "Second Ghostbuster is Ray");
            equal('Egon Spengler', ghostbusters[2], "Third Ghostbuster is Egon");
            equal('Winston Zeddemore', ghostbusters[3], "Ultimate Ghostbuster is Winston");
            ko.ajax.unregisterCallback(endpoint, 'success', arrayTestCallback);
            start();
        };
        ko.ajax.registerCallback(endpoint, 'success', arrayTestCallback);
        viewModel.callGhostbusters(true);
    });
    test("Error", function () {
        var viewModel = {
            call404: ko.observable(false)
        };
        var endpoint = "/server/error.php";
        ko.applyBindings(viewModel);
        stop();
        var errorTestCallback = function (endpointName) {
            equal(endpoint, endpointName, "Error callback was called with correct endpointName");
            equal(false, viewModel.call404(), "Trigger clears even when an error occurs");
            ko.ajax.unregisterCallback(endpoint, 'error', errorTestCallback);
            start();
        };
        ko.ajax.registerCallback(endpoint, 'error', errorTestCallback);
        viewModel.call404(true);
    });
    test("Trigger data-binding", function () {
        var viewModel = {
            sendRequest: ko.observable(false)
        };
        var fragment = $('<input type="button" data-bind="trigger: sendRequest">');
        ko.applyBindings(viewModel, fragment[0]);
        equal(false, viewModel.sendRequest(), "Trigger starts out false");
        fragment.trigger('click');
        equal(true, viewModel.sendRequest(), "Click event sets trigger observable to true");
    });
    test("Receive Simple Observable Array", function () {
        var viewModel = {
                explode: ko.observable(),
                explodeText: ko.observable('Peter,Egon,Ray,Winston'),
                exploded: ko.observableArray([])
            },
            endpoint = '/server/explode.php';
        ko.applyBindings(viewModel);
        stop();
        var testCallback = function (endpointName, data) {
            var exploded = viewModel.exploded();
            equal(4,exploded.length, "Got back four names");
            equal('Peter', exploded[0].name(), "First is Peter");
            equal('Winston', exploded[3].name(), "Last is Winston");
            ko.ajax.unregisterCallback(endpoint, 'success', testCallback);
            start();
        }
        ko.ajax.registerCallback(endpoint, 'success', testCallback);
        viewModel.explode(true);
    });
    test("Send Observable Array with Observables", function () {
        var viewModel = {
                implode: ko.observable(),
                text: ko.observableArray([{name: 'Peter'}, {name: 'Egon}'}, {name: 'Ray'}, {name: 'Winston'}]),
                joined: ko.observable()
            },
            endpoint = '/server/implode.php';
        ko.applyBindings(viewModel);
        stop();
        var testCallback = function (endpointName, data) {
            var joined = viewModel.joined();
            equal('Peter,Egon,Ray,Winston', joined, "Names are joined");
            ko.ajax.unregisterCallback(endpoint, 'success', testCallback);
            start();
        }
        ko.ajax.registerCallback(endpoint, 'success', testCallback);
        viewModel.implode(true);
    });
    test("Send/Receive from the same place", function() {
        var viewModel = {
                doDouble: ko.observable(false),
                doubleMe: ko.observable('foo')
            },
            endpoint = '/server/double.php';
        ko.applyBindings(viewModel);
        stop();
        var testCallback = function (endpointName, data) {
            equal('foofoo',viewModel.doubleMe(), "Foo is doubled to foofoo");
            ko.ajax.unregisterCallback(endpoint, 'success', testCallback);
            start();
        }
        ko.ajax.registerCallback(endpoint, 'success', testCallback);
        viewModel.doDouble(true);
    });
    test("Nested observable arrays with observable content", function() {
        throw new Error("Unimplemented");
    });
    if (mockAjax) {
        test("Long Polling", function () {
            var viewModel = {
                name: ko.observable('Anonymous'),
                msg: ko.observable(''),
                send: ko.observable(false),
                waitForResponse: ko.observable(true),
                receivedFrom: ko.observable(),
                receivedMessage: ko.observable()
            };
            var sendEndpoint = "/send";
            var receiveEndpoint = "/receive";
            var msg = 'Test Message';
            ko.applyBindings(viewModel);
            stop();
            ko.ajax.registerCallback(receiveEndpoint, 'success', function(endpointName, data) {
                equal(data.receivedMessage, msg, "Got back expected message");
                equal(false, viewModel.waitForResponse(), "Trigger still clear");
                viewModel.waitForResponse(true);
                start();
            });
            viewModel.msg(msg);
            viewModel.send(true);
        });
    }
});
