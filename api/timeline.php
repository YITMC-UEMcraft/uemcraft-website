<?php
/**
 * timeline.php — 关于页「发展历程」时间轴 API
 * -------------------------------------------
 * 供关于页时间轴动态展示与后台管理。
 *
 * 接口：
 * - GET  ?action=list          公开列表（按 sort_order 升序）
 * - GET  ?action=admin_list    管理列表（权限节点：timeline）
 * - GET  ?action=admin_detail  单条详情（权限节点：timeline）
 * - POST ?action=create        新增（权限节点：timeline）
 * - POST ?action=update        更新（权限节点：timeline）
 * - POST ?action=delete        删除（权限节点：timeline）
 */

require_once __DIR__ . '/common.php';

/** 时间轴条目字段校验 */
function validateTimelineInput($input, $existing = null) {
    $dateLabel = array_key_exists('date_label', $input) ? trim((string) $input['date_label']) : ($existing['date_label'] ?? '');
    $title = array_key_exists('title', $input) ? trim((string) $input['title']) : ($existing['title'] ?? '');
    $desc = array_key_exists('description', $input) ? trim((string) $input['description']) : ($existing['description'] ?? '');
    $sort = array_key_exists('sort_order', $input) ? intval($input['sort_order']) : (int) ($existing['sort_order'] ?? 0);

    if (charCount($dateLabel) > 50) {
        json_response(['success' => false, 'error' => '日期文字长度应为 0–50 字'], 400);
    }
    if ($title === '' || charCount($title) > 200) {
        json_response(['success' => false, 'error' => '标题长度应为 1–200 字'], 400);
    }
    if (charCount($desc) > 500) {
        json_response(['success' => false, 'error' => '描述长度应为 0–500 字'], 400);
    }
    return ['date_label' => $dateLabel, 'title' => $title, 'description' => $desc, 'sort_order' => $sort];
}

$action = $_GET['action'] ?? '';

try {
    $db = getSiteDb();

    // ---- 公开：时间轴列表 ----
    if ($action === 'list') {
        $stmt = $db->query("SELECT id, date_label, title, description, sort_order FROM timeline_events ORDER BY sort_order ASC, id ASC");
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
        requireAdminNode($db, 'timeline');
        $stmt = $db->query("SELECT * FROM timeline_events ORDER BY sort_order ASC, id ASC");
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
        requireAdminNode($db, 'timeline');
        $id = requireId(['id' => $_GET['id'] ?? 0]);
        $stmt = $db->prepare("SELECT * FROM timeline_events WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) {
            json_response(['success' => false, 'error' => '记录不存在'], 404);
        }
        json_response(['success' => true, 'data' => $row]);
    }

    // ---- 管理：新增 ----
    if ($action === 'create') {
        requireAdminNode($db, 'timeline');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST'], 405);
        }
        $fields = validateTimelineInput(readInput());
        $now = now();
        $stmt = $db->prepare("INSERT INTO timeline_events (date_label, title, description, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$fields['date_label'], $fields['title'], $fields['description'], $fields['sort_order'], $now, $now]);
        json_response(['success' => true, 'data' => ['id' => (int) $db->lastInsertId()]]);
    }

    // ---- 管理：更新 ----
    if ($action === 'update') {
        requireAdminNode($db, 'timeline');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST'], 405);
        }
        $input = readInput();
        $id = requireId($input);
        $stmt = $db->prepare("SELECT * FROM timeline_events WHERE id = ?");
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            json_response(['success' => false, 'error' => '记录不存在'], 404);
        }
        $fields = validateTimelineInput($input, $existing);
        $upd = $db->prepare("UPDATE timeline_events SET date_label = ?, title = ?, description = ?, sort_order = ?, updated_at = ? WHERE id = ?");
        $upd->execute([$fields['date_label'], $fields['title'], $fields['description'], $fields['sort_order'], now(), $id]);
        json_response(['success' => true, 'data' => ['id' => $id]]);
    }

    // ---- 管理：删除 ----
    if ($action === 'delete') {
        requireAdminNode($db, 'timeline');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST'], 405);
        }
        $id = requireId(readInput());
        $stmt = $db->prepare("DELETE FROM timeline_events WHERE id = ?");
        $stmt->execute([$id]);
        json_response(['success' => true, 'data' => ['deleted' => $id]]);
    }

    json_response(['success' => false, 'error' => '未知操作'], 400);
} catch (Throwable $e) {
    error_log('[timeline.php] ' . $e->getMessage());
    json_response(['success' => false, 'error' => '服务器内部错误'], 500);
}
