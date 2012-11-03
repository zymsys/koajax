<?php

class TaskDb
{
    const dbName = 'koatodo';

    /**
     * @var Mongo
     */
    public $mongo;

    /**
     * @var MongoDB
     */
    public $db;

    /**
     * @var TaskDb
     */
    private static $singleton;

    /**
     * @static
     * @return TaskDb
     */
    static function Singleton()
    {
        if (!self::$singleton)
        {
            self::$singleton = new TaskDb();
        }
        return self::$singleton;
    }

    function __construct()
    {
        $this->initDb();
    }

    private function initDb()
    {
        $this->mongo = new Mongo();
        $this->db = $this->mongo->selectDB(self::dbName);
        if (!$this->db)
        {
            $this->db = new MongoDB($this->mongo, self::dbName);
        }
    }
}

class MapperLocator
{
    private static $userMapper;
    private static $taskMapper;

    /**
     * @static
     * @return UserMapper
     */
    public static function UserMapper()
    {
        if (!self::$userMapper)
        {
            self::$userMapper = new UserMapper();
        }
        return self::$userMapper;
    }

    /**
     * @static
     * @return TaskMapper
     */
    public static function TaskMapper()
    {
        if (!self::$taskMapper)
        {
            self::$taskMapper = new TaskMapper();
        }
        return self::$taskMapper;
    }
}

abstract class BaseMapper
{
    /**
     * @var TaskDb
     */
    private $taskDb;

    /**
     * @var MongoCollection
     */
    protected $collection;

    private $_cache = array();

    function __construct()
    {
        $this->taskDb = TaskDb::Singleton();
        $this->collection = new MongoCollection($this->taskDb->db, $this->getCollectionName());
        if (!$this->collection)
        {
            $this->collection = $this->taskDb->db->createCollection($this->getCollectionName());
            if (!$this->collection)
            {
                echo "Unable to create " . $this->getCollectionName() . " collection: ";
                var_dump($this->taskDb->db->prevError());
            }
        }
    }

    abstract function getCollectionName();
}

class UserMapper extends BaseMapper
{
    const expirationInitial = 3600;
    const expirationTopUp = 1800;

    function __construct()
    {
        parent::__construct();
        $this->collection->ensureIndex(array('userName'=>1), array('unique'=>1));
    }

    function getCollectionName()
    {
        return 'users';
    }

    private function password($password, $salt = false)
    {
        if (!$salt)
        {
            $salt = uniqid();
        }
        $password = $salt.$password;
        return $salt . md5($password);
    }

    public function checkPassword($clear, $hashed)
    {
        $salt = substr($hashed, 0, 13);
        return $this->password($clear, $salt) == $hashed;
    }

    function createUser($userName, $password)
    {
        try
        {
            return $this->collection->insert(
                array(
                    'userName'=>$userName,
                    'password'=>$this->password($password),
                    'tokens'=>array()
                ),
                array('safe'=>1)
            );
        }
        catch (MongoCursorException $e)
        {
            if ($e->doc['code'] == 11000) return false; //duplicate user ID
            throw $e;
        }
    }

    function getUser($userName)
    {
        $cursor = $this->collection->find(array('userName'=>$userName));
        foreach ($cursor as $doc) {
            return $doc;
        }
        return false;
    }

    function deleteUser($userName)
    {
        return $this->collection->remove(array('userName'=>$userName));
    }

    function createAuth($userName, $password)
    {
        $user = $this->getUser($userName);
        if (!$this->checkPassword($password, $user['password'])) return false;
        $expireTime = time() + self::expirationInitial;
        $token = uniqid(true);
        $user['tokens'][$token] = $expireTime;
        $this->collection->update(
            array('userName'=>$userName),
            $this->refreshTokens($user)
        );
        return $token;
    }

    private function refreshTokens($user)
    {
        $changed = false;
        $expired = array();
        $now = time();
        $topUp = $now + self::expirationTopUp;
        foreach ($user['tokens'] as $token=>$expiration) {
            if ($expiration < $now) $expired[] = $token;
            if ($expiration < $topUp) {
                $user['tokens'][$token] = $now + self::expirationInitial;
                $changed = true;
            }
        }
        foreach ($expired as $token)
        {
            unset($user['tokens'][$token]);
        }
        if ($changed || $expired)
        {
            $this->collection->update(array('userName'=>$user['userName']), $user);
        }
        return $user;
    }

    public function checkAuth($userName, $token)
    {
        $user = $this->getUser($userName);
        $authenticated = false;
        if (isset($user['tokens'][$token]))
        {
            $authenticated = $user['tokens'][$token] > time();
            if ($authenticated)
            {
                $this->refreshTokens($user);
            }
        }
        return $authenticated;
    }

    public function deAuthorize($userName)
    {
        $user = $this->getUser($userName);
        if ($user)
        {
            $user['tokens'] = array();
            $this->collection->update(array('userName'=>$userName), $user);
        }
    }
}

/*
$userMapper = new UserMapper();
//$result = $userMapper->createUser('vic','xyzzy');
//$result = $userMapper->createAuth('vic','xyzzy');
//$result = $userMapper->deleteUser('vic');
//$result = $userMapper->checkPassword('xyzzy', $result['password']);
$result = $userMapper->deAuthorize('vic');
$result = $userMapper->checkAuth('vic','150806eac2fc31');
var_dump($result);
exit;
*/

class TaskMapper extends BaseMapper
{
    /**
     * @var TaskDb
     */
    private $taskDb;

    /**
     * @var MongoCollection
     */
    private $tasks;

    function getCollectionName()
    {
        return 'tasks';
    }

    function addTask($userName, $authToken, $priority, $task)
    {
        if (MapperLocator::UserMapper()->checkAuth($userName, $authToken))
        {



        }
    }
}

class TaskService
{
    public function route($method, $uri)
    {
    }
}

$svc = new TaskService();
$svc->route($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI']);