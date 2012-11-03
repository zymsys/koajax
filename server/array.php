<?php
$response = new stdClass();
$response->ghostbusters = array(
    "Peter Venkman",
    "Ray Stantz",
    "Egon Spengler",
    "Winston Zeddemore",
);
header('Content-type: application/json');
echo json_encode($response);