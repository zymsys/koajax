<?php
function getJSONRequest()
{
    $raw = file_get_contents('php://input');
    return json_decode($raw);
}
$request = getJSONRequest();
$people = $request['people'];
$newPeople = array();
foreach ($people as $name) {
    $newPeople[] = array(
        "firstName"=>ucfirst($name['firstName']),
        "lastName"=>ucfirst($name['lastName']),
    );
}
header("Content-type: application/json");
echo json_encode($newPeople);