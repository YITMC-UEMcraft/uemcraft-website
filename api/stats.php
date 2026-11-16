<?php
/**
 * stats.php — 首页 Hero 社团数据 API
 * --------------------------------
 * 供首页统计条（注册成员 / 建筑作品 / 已办活动）动态展示与后台管理。
 *
 * 接口：
 * - GET  ?action=list          公开列表（按 sort_order 升序）
 * - GET  ?action=admin_list    管理列表（权限节点：stats）
 * - GET  ?action=admin_detail  单条详情（权限节点：stats）
 * - POST ?action=create        新增（权限节点：stats）
 * - POST ?action=update        更新（权限节点：stats）
 * - POST ?action=delete        删除（权限节点：stats）
 */

require_once __DIR__ . '/common.php';

/** 统计项字段校验 */
function validateStatInput($input, $existing = null) {
    $label = array_key_exists('label', $input) ? trim((string) $input['label']) : ($existing['label'] ?? '');
    $value = array_key_exists('value', $input) ? trim((string) $input['value']) : ($existing['value'] ?? '');
    $sort  = array_key_exists('sort_order', $input) ? intval($input['sort_order']) : (int) ($existing['sort_order'] ?? 0);

    if ($label === '' || charCount($label) > 50) {
        json_response(['success' => false, 'error' => '名称长度应为 1–50 字'], 400);
    }
    if ($value === '' || charCount($value) > 50) {
        json_response(['success' => false, 'error' => '数值长度应为 1–50 字'], 400);
    }
    return ['label' => $label, 'value' => $value, 'sort_order' => $sort];
}

$action = $_GET['action'] ?? '';

try {
    $db = getSiteDb();

    // ---- 公开：统计列表 ----
    if ($action === 'list') {
        $stmt = $db->query("SELECT id, label, value, sort_order FROM site_stats ORDER BY sort_order ASC, id ASC");
        $rows = [];
        foreach ($stmt->fetchAll() as $row) {
            $row['id'] = (int) $row['id'];
            $row['sort_order'] = (int) $row['sort_order'];
            $rows[] = $row;
        }
        json_response(['success' => true, 'data' => $rows]);
    }

    // ---- 管理：列表 ----
    if ($action === 'admin_list') {
        requireAdminNode($db, 'stats');
        $stmt = $db->query("SELECT * FROM site_stats ORDER BY sort_order ASC, id ASC");
        $rows = [];
        foreach ($stmt->fetchAll() as $row) {
            $row['id'] = (int) $row['id'];
            $row['sort_order'] = (int) $row['sort_order'];
            $row['created_at'] = (int) $row['created_at'];
            $row['updated_at'] = (int) $row['updated_at'];
            $rows[] = $row;
        }
        json_response(['success' => true, 'data' => $rows]);
    }

    // ---- 管理：详情 ----
    if ($action === 'admin_detail') {
        requireAdminNode($db, 'stats');
        $id = requireId(['id' => $_GET['id'] ?? 0]);
        $stmt = $db->prepare("SELECT * FROM site_stats WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) {
            json_response(['success' => false, 'error' => '记录不存在'], 404);
        }
        json_response(['success' => true, 'data' => $row]);
    }

    // ---- 管理：新增 ----
    if ($action === 'create') {
        requireAdminNode($db, 'stats');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST'], 405);
        }
        $fields = validateStatInput(readInput());
        $now = now();
        $stmt = $db->prepare("INSERT INTO site_stats (label, value, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$fields['label'], $fields['value'], $fields['sort_order'], $now, $now]);
        json_response(['success' => true, 'data' => ['id' => (int) $db->lastInsertId()]]);
    }

    // ---- 管理：更新 ----
    if ($action === 'update') {
        requireAdminNode($db, 'stats');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST'], 405);
        }
        $input = readInput();
        $id = requireId($input);
        $stmt = $db->prepare("SELECT * FROM site_stats WHERE id = ?");
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            json_response(['success' => false, 'error' => '记录不存在'], 404);
        }
        $fields = validateStatInput($input, $existing);
        $upd = $db->prepare("UPDATE site_stats SET label = ?, value = ?, sort_order = ?, updated_at = ? WHERE id = ?");
        $upd->execute([$fields['label'], $fields['value'], $fields['sort_order'], now(), $id]);
        json_response(['success' => true, 'data' => ['id' => $id]]);
    }

    // ---- 管理：删除 ----
    if ($action === 'delete') {
        requireAdminNode($db, 'stats');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST'], 405);
        }
        $id = requireId(readInput());
        $stmt = $db->prepare("DELETE FROM site_stats WHERE id = ?");
        $stmt->execute([$id]);
        json_response(['success' => true, 'data' => ['deleted' => $id]]);
    }

    json_response(['success' => false, 'error' => '未知操作'], 400);
} catch (Throwable $e) {
    error_log('[stats.php] ' . $e->getMessage());
    json_response(['success' => false, 'error' => '服务器内部错误'], 500);
}
