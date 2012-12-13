ko.ajax
=======

*Warning: I really liked this when I first wrote it, but after using it a couple of times I've grown to dislike
it.  I object to the fact that I typically need two script blocks for each endpoint - one for incoming and one
for outgoing data streams.  I expect to do a rewrite which merges these into one less confusing block of json.
So if you use this, expect everything to change soon.  I don't expect to bother maintaining backward 
compatibility.*

Ko.ajax is a knockout.js extension which allows you to create AJAX mappings to/from your knockout view models.  
In the same way that knockout.js allows you to declaratively bind your UI to your view model, ko.ajax allows 
you to bind your view model to your AJAX services.  With bindings in place, your UI can interact with server 
data seamlessly.

Simple Example
--------------

Mappings between AJAX services and your view model are declared in script blocks like this:

    <script data-bind="ajax: '/server/echo.php'" type="application/json">
    {
        "type": "POST",
        "trigger": "sendPing",
        "send": {
            "send":"ping"
        },
        "receive": {
            "pong": "response",
        }
    }
    </script>

Here’s the view model for this:

    var viewModel = {
        "sendPing": ko.observable(false),
        "ping": ko.observable("One ping, and one ping only”),
        "pong": ko.observable(),
    };

The script element uses an ajax binding which is provided by ko.ajax, and declares itself to be of type
application/json.  All AJAX bindings must be of type application/json.  The data-binding links this AJAX declaration
to a service at `/server/echo.php`.

The first two JSON values set the HTTP method for the request to POST, and say that the trigger to initiate the
request is sendPing in the view model.  The trigger is observed using knockout, and when it becomes truthy the
request is sent.

The send block maps the view model to request variables.  In this case we’re sending a request variable called `send`,
and populating that value from `ping` in our view model.

The receive block performs the reverse mapping of the response back to the view model.  Mapped responses are always
expected to be JSON from the server.  Other response types can be handled with a special wildcard mapping described
later.  In this example we’re populating `pong` in our view model with the `response` value in the response.

In this example the single variable `send` would be sent in a POST to the server, which would respond with this json:

    {"response":"One ping, and one ping only"}

This value would then be mapped to our view model’s `pong` variable.

Mapping Nested Values
——————————

Often view models and requests will contain many objects within objects to better organize values.  You can refer to
nested variables in either the view model, the response, or even the request with / characters.  For example, given
this view model:

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

We might create this ajax declaration:

    <script data-bind="ajax: '/server/deep.php'" type="application/json">
    {
        "type": "POST",
        "contentType": "application/json",
        "trigger": "triggers/sendName",
        "send": {
            "name/first": "inputFields/first",
            "name/last": "inputFields/last"
        },
        "receive": {
            "outputFields/fullName": "calculated/fullName"
        }
    }
    </script>

Notice that we’ve introduced a contentType key which allows us to send JSON encoded requests.  These are also handy
for preserving data types such as boolean, which otherwise are converted to strings.

Shorthand Triggers
—————————

In addition to the ajax data-binding, ko.ajax also provides a trigger binding which simply sets a trigger value to
true.  If our view model had a trigger called `Send` we might make a button to initiate the request like this:

    <input type="button" data-bind="trigger:send" value="Send">

Mapping Simple Arrays
——————————

Simple arrays can be mapped in the same way that any other observable is mapped.

Mapping Arrays of Observables
——————————————

Events and Error Handling
————————————

Comet / Long Polling
——————————

