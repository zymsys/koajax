<?php
$response = new stdClass();
$response->response = $_POST['send'];
header('Content-type: application/json');
echo json_encode($response);