/*
Idea: data binding for trigger which simply sets an observable to true.  Eliminate the need for silly little
methods to trigger AJAX requests.
*/
function logObservable(parent, observableName) {
    var original = parent[observableName],
        readValue;
    parent[observableName] = function (value) {
        if (typeof value == 'undefined') {
            readValue = original();
            return readValue;
        } else {
            return original(value);
        }
    }
}

$(function () {
    var viewModel = {
        name: ko.observable('Anonymous'),
        msg: ko.observable(''),
        send: ko.observable(false),
        waitForResponse: ko.observable(true),
        receivedFrom: ko.observable(),
        receivedMessage: ko.observable()
    };

    ko.computed(function () {
        var waiting = viewModel.waitForResponse();
        if (!waiting) {
            var from = viewModel.receivedFrom();
            var message = viewModel.receivedMessage();
            if (message) {
                var fragment = $('<div>')
                    .append($('<strong>').text(from + ': '))
                    .append($('<span>').text(message));
                $('#chatter').append(fragment);
            }
            viewModel.receivedMessage(undefined);
            viewModel.waitForResponse(true);
        }
    }, viewModel);

    logObservable(viewModel, 'waitForResponse');

    ko.applyBindings(viewModel);
});
