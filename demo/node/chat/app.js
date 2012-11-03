/**
 * Demo chat server fo
 */

var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , path = require('path');

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.static(path.normalize(
      [__dirname, '..', '..', '..', 'scripts'].join(path.sep)
  )));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

var subscriptions = [];

app.get('/', express.static(path.join(__dirname, 'public','index.html')));

app.get('/receive', function (request, response) {
    subscriptions.push(response);
});

app.post('/send', function (request, response) {
    var index, subscription;
    for (index = 0; index < subscriptions.length; index += 1) {
        subscription = subscriptions[index];
        subscription.send(request.body);
    }
    subscriptions = []; //Clear all subscriptions
    response.send({status:'ok'});
});

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
