<?php
// Zapatería Red — API del panel administrativo (sesión + CRUD + uploads).
// BD: ventas_zapateria en 127.0.0.1:3307, usuario root sin clave (config XAMPP local).
session_start();
header('Content-Type: application/json; charset=utf-8');

function db() {
  static $c = null;
  if ($c === null) {
    $c = new mysqli('127.0.0.1', 'root', '', 'ventas_zapateria', 3307);
    if ($c->connect_error) { http_response_code(500); echo json_encode(['ok' => false, 'error' => 'BD no disponible']); exit; }
    $c->set_charset('utf8mb4');
  }
  return $c;
}
function body() {
  $raw = file_get_contents('php://input');
  $j = json_decode($raw, true);
  return is_array($j) ? $j : [];
}
function out($data, $code = 200) { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }
function require_admin() {
  if (empty($_SESSION['admin_id'])) { out(['ok' => false, 'error' => 'No autenticado'], 401); }
}
function is_admin_row($r) { return isset($r['rol']) && $r['rol'] === 'admin'; }

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// ---------- Sesión ----------
if ($action === 'login' && $method === 'POST') {
  $b = body();
  $email = trim($b['email'] ?? '');
  $pass = (string)($b['password'] ?? '');
  if ($email === '' || $pass === '') { out(['ok' => false, 'error' => 'Email y contraseña requeridos'], 400); }
  $stmt = db()->prepare('SELECT id, nombre, email, password, rol FROM usuarios WHERE email = ? LIMIT 1');
  $stmt->bind_param('s', $email);
  $stmt->execute();
  $row = $stmt->get_result()->fetch_assoc();
  // Esquema actual de la tabla: clave en texto plano (compatibilidad con datos existentes).
  if (!$row || $row['password'] !== $pass) { out(['ok' => false, 'error' => 'Credenciales inválidas'], 401); }
  if (!is_admin_row($row)) { out(['ok' => false, 'error' => 'Esta cuenta no tiene rol de administrador'], 403); }
  session_regenerate_id(true);
  $_SESSION['admin_id'] = (int)$row['id'];
  $_SESSION['admin_nombre'] = $row['nombre'];
  $_SESSION['admin_email'] = $row['email'];
  out(['ok' => true, 'user' => ['id' => (int)$row['id'], 'nombre' => $row['nombre'], 'email' => $row['email'], 'rol' => $row['rol']]]);
}
if ($action === 'logout' && $method === 'POST') {
  session_unset(); session_destroy();
  out(['ok' => true]);
}
if ($action === 'me') {
  if (empty($_SESSION['admin_id'])) { out(['ok' => false], 401); }
  out(['ok' => true, 'user' => ['id' => $_SESSION['admin_id'], 'nombre' => $_SESSION['admin_nombre'], 'email' => $_SESSION['admin_email']]]);
}

// ---------- Lecturas del panel ----------
if ($action === 'productos') {
  require_admin();
  $q = '%' . trim($_GET['q'] ?? '') . '%';
  $estado = $_GET['estado'] ?? 'Todos';
  $sql = "SELECT z.id, z.nombre, z.marca, z.descripcion, z.precio, z.stock, z.imagen,
                 z.categoria_id, z.talle_id, c.nombre AS categoria, t.nombre AS talle,
                 (SELECT COUNT(*) FROM zapato_imagenes i WHERE i.zapato_id = z.id) AS fotos
          FROM zapatos z
          LEFT JOIN categorias c ON c.id = z.categoria_id
          LEFT JOIN talles t ON t.id = z.talle_id
          WHERE (z.nombre LIKE ? OR z.marca LIKE ?)";
  if ($estado === 'Sin stock') { $sql .= ' AND z.stock <= 0'; }
  $sql .= ' ORDER BY z.id DESC';
  $stmt = db()->prepare($sql);
  $stmt->bind_param('ss', $q, $q);
  $stmt->execute();
  out(['ok' => true, 'productos' => $stmt->get_result()->fetch_all(MYSQLI_ASSOC)]);
}
if ($action === 'producto') {
  require_admin();
  $id = (int)($_GET['id'] ?? 0);
  $stmt = db()->prepare('SELECT z.*, c.nombre AS categoria, t.nombre AS talle FROM zapatos z LEFT JOIN categorias c ON c.id=z.categoria_id LEFT JOIN talles t ON t.id=z.talle_id WHERE z.id=?');
  $stmt->bind_param('i', $id);
  $stmt->execute();
  $p = $stmt->get_result()->fetch_assoc();
  if (!$p) { out(['ok' => false, 'error' => 'Producto no encontrado'], 404); }
  $stmt = db()->prepare('SELECT id, url, es_portada, orden FROM zapato_imagenes WHERE zapato_id=? ORDER BY es_portada DESC, orden ASC, id ASC');
  $stmt->bind_param('i', $id);
  $stmt->execute();
  $p['imagenes'] = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
  out(['ok' => true, 'producto' => $p]);
}
if ($action === 'categorias' || $action === 'talles') {
  require_admin();
  $tabla = $action === 'categorias' ? 'categorias' : 'talles';
  $rows = db()->query("SELECT id, nombre FROM `$tabla` ORDER BY nombre")->fetch_all(MYSQLI_ASSOC);
  out(['ok' => true, 'items' => $rows]);
}
if ($action === 'analitica') {
  require_admin();
  $c = db();
  $tot = $c->query('SELECT COUNT(*) n, COALESCE(SUM(stock),0) stock, COALESCE(SUM(precio*stock),0) valor FROM zapatos')->fetch_assoc();
  $porCat = $c->query("SELECT COALESCE(c.nombre,'Sin categoría') categoria, COUNT(*) productos, COALESCE(SUM(z.stock),0) stock, COALESCE(SUM(z.precio*z.stock),0) valor FROM zapatos z LEFT JOIN categorias c ON c.id=z.categoria_id GROUP BY categoria ORDER BY valor DESC")->fetch_all(MYSQLI_ASSOC);
  $bajo = $c->query('SELECT id, nombre, marca, stock FROM zapatos WHERE stock < 8 ORDER BY stock ASC LIMIT 10')->fetch_all(MYSQLI_ASSOC);
  out(['ok' => true, 'resumen' => $tot, 'por_categoria' => $porCat, 'stock_bajo' => $bajo]);
}
if ($action === 'clientes') {
  require_admin();
  $rows = db()->query('SELECT id, nombre, email, rol FROM usuarios ORDER BY id ASC')->fetch_all(MYSQLI_ASSOC);
  out(['ok' => true, 'clientes' => $rows]);
}
if ($action === 'configuracion' && $method === 'GET') {
  require_admin();
  $rows = db()->query('SELECT clave, valor FROM configuracion')->fetch_all(MYSQLI_ASSOC);
  $cfg = [];
  foreach ($rows as $r) { $cfg[$r['clave']] = $r['valor']; }
  out(['ok' => true, 'config' => $cfg]);
}

// ---------- Uploads ----------
function guardar_fotos($zapato_id) {
  $guardadas = [];
  if (empty($_FILES['fotos'])) { return $guardadas; }
  $permitidas = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
  $nombres = is_array($_FILES['fotos']['name']) ? $_FILES['fotos']['name'] : [$_FILES['fotos']['name']];
  $tmps = is_array($_FILES['fotos']['tmp_name']) ? $_FILES['fotos']['tmp_name'] : [$_FILES['fotos']['tmp_name']];
  $sizes = is_array($_FILES['fotos']['size']) ? $_FILES['fotos']['size'] : [$_FILES['fotos']['size']];
  $errors = is_array($_FILES['fotos']['error']) ? $_FILES['fotos']['error'] : [$_FILES['fotos']['error']];
  $dir = __DIR__ . '/assets';
  if (!is_dir($dir)) { mkdir($dir, 0777, true); }
  $c = db();
  $orden = (int)($c->query("SELECT COALESCE(MAX(orden),-1)+1 o FROM zapato_imagenes WHERE zapato_id=$zapato_id")->fetch_assoc()['o']);
  $hay_portada = (int)($c->query("SELECT COUNT(*) n FROM zapato_imagenes WHERE zapato_id=$zapato_id AND es_portada=1")->fetch_assoc()['n']) > 0;
  foreach ($nombres as $i => $orig) {
    if ($errors[$i] !== UPLOAD_ERR_OK || $sizes[$i] > 5 * 1024 * 1024) { continue; }
    $ext = strtolower(pathinfo($orig, PATHINFO_EXTENSION));
    if (!isset($permitidas[$ext])) { continue; }
    $nuevo = 'prod_' . $zapato_id . '_' . uniqid() . '.' . $ext;
    if (!move_uploaded_file($tmps[$i], $dir . '/' . $nuevo)) { continue; }
    $url = 'assets/' . $nuevo;
    $portada = $hay_portada ? 0 : 1;
    $stmt = $c->prepare('INSERT INTO zapato_imagenes (zapato_id, url, es_portada, orden) VALUES (?, ?, ?, ?)');
    $stmt->bind_param('isii', $zapato_id, $url, $portada, $orden);
    $stmt->execute();
    if ($portada) { $c->query("UPDATE zapatos SET imagen='" . $c->real_escape_string($url) . "' WHERE id=$zapato_id"); $hay_portada = true; }
    $guardadas[] = ['id' => $stmt->insert_id, 'url' => $url, 'es_portada' => $portada, 'orden' => $orden];
    $orden++;
  }
  return $guardadas;
}

// ---------- Escrituras ----------
if ($action === 'crear_producto' && $method === 'POST') {
  require_admin();
  $nombre = trim($_POST['nombre'] ?? '');
  $marca = trim($_POST['marca'] ?? 'Red Label');
  $descripcion = trim($_POST['descripcion'] ?? '');
  $precio = (float)($_POST['precio'] ?? 0);
  $stock = (int)($_POST['stock'] ?? 0);
  $categoria_id = ($_POST['categoria_id'] ?? '') === '' ? null : (int)$_POST['categoria_id'];
  $talle_id = ($_POST['talle_id'] ?? '') === '' ? null : (int)$_POST['talle_id'];
  if ($nombre === '' || $precio <= 0) { out(['ok' => false, 'error' => 'Nombre y precio válido requeridos'], 400); }
  $stmt = db()->prepare('INSERT INTO zapatos (nombre, marca, descripcion, precio, stock, categoria_id, talle_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
  // categoria/talle pueden ser NULL: se usa bind con variables y tipos dinámicos simples
  $stmt->bind_param('sssdiii', $nombre, $marca, $descripcion, $precio, $stock, $categoria_id, $talle_id);
  if (!$stmt->execute()) { out(['ok' => false, 'error' => 'No se pudo crear: ' . db()->error], 500); }
  $id = $stmt->insert_id;
  $fotos = guardar_fotos($id);
  out(['ok' => true, 'id' => $id, 'fotos' => $fotos]);
}
if ($action === 'actualizar_producto' && $method === 'POST') {
  require_admin();
  $id = (int)($_POST['id'] ?? 0);
  if ($id <= 0) { out(['ok' => false, 'error' => 'ID inválido'], 400); }
  $nombre = trim($_POST['nombre'] ?? '');
  $marca = trim($_POST['marca'] ?? 'Red Label');
  $descripcion = trim($_POST['descripcion'] ?? '');
  $precio = (float)($_POST['precio'] ?? 0);
  $stock = (int)($_POST['stock'] ?? 0);
  $categoria_id = ($_POST['categoria_id'] ?? '') === '' ? null : (int)$_POST['categoria_id'];
  $talle_id = ($_POST['talle_id'] ?? '') === '' ? null : (int)$_POST['talle_id'];
  if ($nombre === '' || $precio <= 0) { out(['ok' => false, 'error' => 'Nombre y precio válido requeridos'], 400); }
  $stmt = db()->prepare('UPDATE zapatos SET nombre=?, marca=?, descripcion=?, precio=?, stock=?, categoria_id=?, talle_id=? WHERE id=?');
  $stmt->bind_param('sssdiiii', $nombre, $marca, $descripcion, $precio, $stock, $categoria_id, $talle_id, $id);
  if (!$stmt->execute()) { out(['ok' => false, 'error' => 'No se pudo actualizar'], 500); }
  // Eliminar fotos marcadas
  $del = json_decode($_POST['eliminar_fotos'] ?? '[]', true);
  if (is_array($del) && $del) {
    $ids = implode(',', array_map('intval', $del));
    db()->query("DELETE FROM zapato_imagenes WHERE id IN ($ids) AND zapato_id = $id");
    // Si se borró la portada, promover la primera restante
    $n = (int)(db()->query("SELECT COUNT(*) n FROM zapato_imagenes WHERE zapato_id=$id AND es_portada=1")->fetch_assoc()['n']);
    if ($n === 0) {
      $prim = db()->query("SELECT id, url FROM zapato_imagenes WHERE zapato_id=$id ORDER BY orden ASC, id ASC LIMIT 1")->fetch_assoc();
      if ($prim) {
        db()->query("UPDATE zapato_imagenes SET es_portada=1 WHERE id=" . (int)$prim['id']);
        db()->query("UPDATE zapatos SET imagen='" . db()->real_escape_string($prim['url']) . "' WHERE id=$id");
      } else {
        db()->query("UPDATE zapatos SET imagen=NULL WHERE id=$id");
      }
    }
  }
  // Cambiar portada si se indica
  $portada_id = (int)($_POST['portada_id'] ?? 0);
  if ($portada_id > 0) {
    db()->query("UPDATE zapato_imagenes SET es_portada=0 WHERE zapato_id=$id");
    db()->query("UPDATE zapato_imagenes SET es_portada=1 WHERE id=$portada_id AND zapato_id=$id");
    $u = db()->query("SELECT url FROM zapato_imagenes WHERE id=$portada_id")->fetch_assoc();
    if ($u) { db()->query("UPDATE zapatos SET imagen='" . db()->real_escape_string($u['url']) . "' WHERE id=$id"); }
  }
  $fotos = guardar_fotos($id);
  out(['ok' => true, 'fotos_nuevas' => $fotos]);
}
if ($action === 'eliminar_producto' && $method === 'POST') {
  require_admin();
  $b = body();
  $id = (int)($b['id'] ?? 0);
  if ($id <= 0) { out(['ok' => false, 'error' => 'ID inválido'], 400); }
  $stmt = db()->prepare('DELETE FROM zapatos WHERE id=?');
  $stmt->bind_param('i', $id);
  $stmt->execute();
  if ($stmt->affected_rows === 0) { out(['ok' => false, 'error' => 'Producto no encontrado'], 404); }
  out(['ok' => true]);
}
if ($action === 'actualizar_rol' && $method === 'POST') {
  require_admin();
  $b = body();
  $id = (int)($b['id'] ?? 0);
  $rol = $b['rol'] ?? '';
  if (!in_array($rol, ['admin', 'usuario'], true)) { out(['ok' => false, 'error' => 'Rol inválido'], 400); }
  if ($id === (int)$_SESSION['admin_id']) { out(['ok' => false, 'error' => 'No puedes cambiar tu propio rol'], 400); }
  $stmt = db()->prepare('UPDATE usuarios SET rol=? WHERE id=?');
  $stmt->bind_param('si', $rol, $id);
  $stmt->execute();
  out(['ok' => true]);
}
if ($action === 'eliminar_usuario' && $method === 'POST') {
  require_admin();
  $b = body();
  $id = (int)($b['id'] ?? 0);
  if ($id === (int)$_SESSION['admin_id']) { out(['ok' => false, 'error' => 'No puedes eliminar tu propia cuenta'], 400); }
  $stmt = db()->prepare('DELETE FROM usuarios WHERE id=?');
  $stmt->bind_param('i', $id);
  $stmt->execute();
  out(['ok' => $stmt->affected_rows > 0]);
}
if ($action === 'guardar_configuracion' && $method === 'POST') {
  require_admin();
  $b = body();
  $permitidas = ['nombre_tienda', 'whatsapp', 'envio_gratis_minimo', 'moneda'];
  $stmt = db()->prepare('INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor=VALUES(valor)');
  foreach ($permitidas as $k) {
    if (array_key_exists($k, $b)) {
      $v = (string)$b[$k];
      $stmt->bind_param('ss', $k, $v);
      $stmt->execute();
    }
  }
  out(['ok' => true]);
}
if ($action === 'crear_usuario' && $method === 'POST') {
  require_admin();
  $b = body();
  $nombre = trim($b['nombre'] ?? '');
  $email = trim($b['email'] ?? '');
  $pass = (string)($b['password'] ?? '');
  $rol = $b['rol'] ?? 'usuario';
  if ($nombre === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($pass) < 6) { out(['ok' => false, 'error' => 'Nombre, email válido y clave de mínimo 6 caracteres'], 400); }
  if (!in_array($rol, ['admin', 'usuario'], true)) { out(['ok' => false, 'error' => 'Rol inválido'], 400); }
  $stmt = db()->prepare('INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)');
  $stmt->bind_param('ssss', $nombre, $email, $pass, $rol);
  if (!$stmt->execute()) { out(['ok' => false, 'error' => 'No se pudo crear (¿email duplicado?)'], 500); }
  out(['ok' => true, 'id' => $stmt->insert_id]);
}
if ($action === 'actualizar_perfil' && $method === 'POST') {
  require_admin();
  $b = body();
  $nombre = trim($b['nombre'] ?? '');
  $email = trim($b['email'] ?? '');
  if ($nombre === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) { out(['ok' => false, 'error' => 'Nombre y email válido requeridos'], 400); }
  $id = (int)$_SESSION['admin_id'];
  $stmt = db()->prepare('UPDATE usuarios SET nombre=?, email=? WHERE id=?');
  $stmt->bind_param('ssi', $nombre, $email, $id);
  if (!$stmt->execute()) { out(['ok' => false, 'error' => 'No se pudo actualizar (¿email en uso?)'], 500); }
  $_SESSION['admin_nombre'] = $nombre;
  $_SESSION['admin_email'] = $email;
  out(['ok' => true]);
}
if ($action === 'cambiar_password' && $method === 'POST') {
  require_admin();
  $b = body();
  $actual = (string)($b['actual'] ?? '');
  $nueva = (string)($b['nueva'] ?? '');
  if (strlen($nueva) < 6) { out(['ok' => false, 'error' => 'La nueva clave debe tener mínimo 6 caracteres'], 400); }
  $id = (int)$_SESSION['admin_id'];
  $row = db()->query("SELECT password FROM usuarios WHERE id=$id")->fetch_assoc();
  if (!$row || $row['password'] !== $actual) { out(['ok' => false, 'error' => 'La clave actual no coincide'], 401); }
  $stmt = db()->prepare('UPDATE usuarios SET password=? WHERE id=?');
  $stmt->bind_param('si', $nueva, $id);
  $stmt->execute();
  out(['ok' => true]);
}

out(['ok' => false, 'error' => 'Acción no válida'], 404);
