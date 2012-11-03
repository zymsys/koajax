<?php
$rawRequest = file_get_contents('php://input');
$request = json_decode($rawRequest);
$response = new stdClass();
$response->components = new stdClass();
$response->components->first = $request->name->first;
$response->components->last = $request->name->last;
$response->calculated = new stdClass();
$response->calculated->fullName = $request->name->first . ' ' . $request->name->last;
header('Content-type: application/json');
echo json_encode($response);