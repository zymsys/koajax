/**
 * ko.ajax 0.0.1
 *
 * By Vic Metcalfe (app.net: @vicm, twitter: @v_metcalfe)
 * https://github.com/zymsys/koajax
 *
 * MIT License:
 * Copyright (C) 2012 Vic Metcalfe
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of
 * the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
 * WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS
 * OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
(function () {
    var global = Function('return this')() || (42, eval)('this'),
        hasRun;
    if (!global.define) {
        global.define = function (dependencies, callback) {
            if (!hasRun) {
                hasRun = true;
                callback(ko, $);
            }
        }
    }
    define(['knockout', 'jquery'], function (ko, $) {
        if (!$) $ = global.jQuery;
        var util = {
            getPropertyFromPath: function (o, path, required) {
                var key,
                    pathParts = path.split('/');
                if (typeof required == 'undefined') required = true;
                while (pathParts.length > 0) {
                    key = pathParts.shift();
                    if (!o[key]) {
                        if (required) {
                            throw new Error("Can't find path (" + path + ").");
                        } else {
                            return undefined;
                        }
                    }
                    o = o[key];
                }
                return o;
            },
            setFromPath: function (o, path, newValue) {
                var isObservable = (path.substr(path.length-2) == '()');
                if (isObservable) {
                    path = path.substr(0,path.length-2);
                }
                var pathInfo = util.getPropertyFromPath(o, path, true);
                if (isObservable) {
                    pathInfo(newValue);
                } else {
                    pathInfo.object[pathInfo.property] = newValue;
                }
            }
        };
        ko.bindingHandlers.ajax = {
            init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                var endpointText = $(element).html();
                var config = {
                    viewModel: viewModel,
                    endpoints: {}
                }
                config.endpoints[valueAccessor()] = JSON.parse(endpointText);
                ko.ajax(config);
            }
        };
        ko.bindingHandlers.trigger = {
            init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                $(element).click(function () {
                    var value = valueAccessor();
                    value(true);
                });
            }
        };
        ko.ajax = function (config) {
            var endpointName, endpoint, trigger, activeEndpoints = {};
            function checkRequiredField(field) {
                if (!config[field]) throw new Error("Knockout.JS AJAX config missing required field: " + field);
            }
            checkRequiredField('viewModel');
            checkRequiredField('endpoints');
            function executeCallbacks(callbackType, endpointName, data, sendRequestCallback) {
                var callback, callbackIndex, didExecuteCallback,
                    callbacksExecuted = false;
                for (callbackIndex in ko.ajax.callbacks[callbackType][endpointName]) {
                    callback = ko.ajax.callbacks[callbackType][endpointName][callbackIndex];
                    didExecuteCallback = callback(endpointName, data, sendRequestCallback);
                    if (didExecuteCallback) {
                        callbacksExecuted = true;
                        sendRequestCallback = undefined;
                    }
                }
                return callbacksExecuted;
            }
            function mapResponseToViewModel(endpoint, response) {
                function setObservable(observable, value) {
                    observable(value);
                }
                var targetPath,
                    observableItem, responsePath,
                    sourceName, arrayItem, i, j,
                    responseItem, responseData;
                if (endpoint.receive['*']) {
                    //Entire response mapped to one target
                    observableItem = util.getPropertyFromPath(config.viewModel, endpoint.receive['*']);
                    setObservable(observableItem, response);
                } else {
                    for (targetPath in endpoint.receive) {
                        observableItem = util.getPropertyFromPath(config.viewModel, targetPath);
                        responsePath = endpoint.receive[targetPath];
                        switch (typeof responsePath) {
                            case 'undefined':
                                continue;
                            case 'string':
                                responseItem = util.getPropertyFromPath(response, responsePath, false);
                                break;
                            default:
                                responseData = util.getPropertyFromPath(response, responsePath.viewModelPath);
                                responseItem = [];
                                for (i = 0, j = responseData.length; i < j; i += 1) {
                                    arrayItem = {};
                                    for (sourceName in responsePath.map) {
                                        arrayItem[responsePath.map[sourceName]] = ko.observable(responseData[i][sourceName]);
                                    }
                                    responseItem.push(arrayItem)
                                }
                                break;
                        }
                        setObservable(observableItem, responseItem);
                    }
                }
                observableItem = util.getPropertyFromPath(config.viewModel, endpoint.trigger);
                observableItem(false); //Clear trigger value
            }
            function setRequestDatum(requestData, path, value) {
                var pathPart,
                    pathParts = path.split('/');
                while (pathParts.length > 1) {
                    pathPart = pathParts.shift();
                    if (!requestData[pathPart]) requestData[pathPart] = {};
                    requestData = requestData[pathPart];
                }
                pathPart = pathParts.shift();
                if (pathPart[0] == '?') {
                    //Conditional assignment - only assign if value is truthy
                    pathPart = pathPart.substr(1);
                    if (!value) return;
                    if (value == '0') return;
                }
                requestData[pathPart] = value;
            }
            function setRequestData(requestData, path, map, observableArray) {
                var pathPart,
                    pathParts = path.split('/'),
                    i, j, item, sourceData, targetData, sourceName,
                    observedArray = observableArray.peek(),
                    newArray = [],
                    reverseMap = {};
                $.each(map, function (key, value) {
                    reverseMap[value] = key;
                });
                while (pathParts.length > 1) {
                    pathPart = pathParts.shift();
                    if (!requestData[pathPart]) requestData[pathPart] = {};
                    requestData = requestData[pathPart];
                }
                pathPart = pathParts.shift();
                for (i = 0, j = observedArray.length; i < j; i += 1) {
                    sourceData = observedArray[i];
                    targetData = {};
                    for (sourceName in sourceData) {
                        item = sourceData[sourceName];
                        targetData[reverseMap[sourceName]] = (item.peek && typeof item.peek == 'function') ? item.peek() : item;
                    }
                    newArray.push(targetData);
                }
                requestData[pathPart] = newArray;
            }
            function mapRequestData(endpoint, requestConfig) {
                var requestPath,
                    observable,
                    target,
                    data = {};
                for (requestPath in endpoint.send) {
                    target = endpoint.send[requestPath];
                    switch (typeof target) {
                        case 'undefined':
                            continue;
                        case 'string':
                            observable = util.getPropertyFromPath(config.viewModel, endpoint.send[requestPath]);
                            setRequestDatum(data, requestPath, observable.peek());
                            break;
                        default:
                            observable = util.getPropertyFromPath(config.viewModel, endpoint.send[requestPath].viewModelPath);
                            setRequestData(data, requestPath, endpoint.send[requestPath].map, observable);
                            break;
                    }
                }
                requestConfig.data = data;
            }
            function registerTrigger(endpointName) {
                var endpoint = config.endpoints[endpointName];
                if (!endpoint.receive) endpoint.receive = {};
                function registerDependentObservable(endpoint, trigger) {
                    ko.computed(function () {
                        var triggerValue = trigger();
                        if (triggerValue && !activeEndpoints[endpointName]) {
                            activeEndpoints[endpointName] = true;
                            var requestConfig = {
                                success: function(data) {
                                    activeEndpoints[endpointName] = false;
                                    mapResponseToViewModel(endpoint, data);
                                    executeCallbacks('success', endpointName, data);
                                },
                                error: function() {
                                    var observableItem = util.getPropertyFromPath(config.viewModel, endpoint.trigger);
                                    activeEndpoints[endpointName] = false;
                                    observableItem(false); //Clear trigger value
                                    executeCallbacks('error', endpointName);
                                }
                            };
                            mapRequestData(endpoint, requestConfig);
                            if (endpoint.type) requestConfig.type = endpoint.type;
                            if (endpoint.contentType) {
                                requestConfig.contentType = endpoint.contentType;
                                requestConfig.data = JSON.stringify(requestConfig.data);
                            }
                            function sendAjaxRequest() {
                                var url = endpointName.replace("{}", triggerValue);
                                $.ajax(url, requestConfig);
                            }
                            var callbacksExecuted;
                            callbacksExecuted = executeCallbacks('before', endpointName, requestConfig, sendAjaxRequest);
                            if (!callbacksExecuted) {
                                sendAjaxRequest();
                            }
                        }
                    }, config.viewModel);
                }
                trigger = util.getPropertyFromPath(config.viewModel, endpoint.trigger, false);
                if (trigger) {
                    registerDependentObservable(endpoint, trigger);
                }
            }
            for (endpointName in config.endpoints) {
                if (!config.endpoints.hasOwnProperty(endpointName)) continue;
                registerTrigger(endpointName);
            }
        };
        ko.ajax.util = util;
        ko.ajax.callbacks = {
            before: {},
            success: {},
            error: {}
        };
        ko.ajax.registerCallback = function (endpoint, callbackType, callback) {
            var callbackStack = ko.ajax.callbacks[callbackType];
            if (!callbackStack[endpoint]) callbackStack[endpoint] = [];
            callbackStack[endpoint].push(callback);
        };
        ko.ajax.unregisterCallback = function (endpoint, callbackType, callback) {
            var index;
            if (!ko.ajax.callbacks[callbackType][endpoint]) throw new Error("No callbacks registered for endpoint: " + endpoint);
            for (index in ko.ajax.callbacks[callbackType][endpoint]) {
                if (ko.ajax.callbacks[callbackType][endpoint][index] === callback) {
                    ko.ajax.callbacks[callbackType][endpoint].splice(index, 1);
                    return;
                }
            }
        }
    });
})();
