'use strict';

// 控制 Jira 下拉菜单的开关
function toggleJiraDropdown() {
    document.getElementById('jira-dropdown').classList.toggle('open');
    const expDropdown = document.getElementById('export-dropdown');
    if (expDropdown) expDropdown.classList.remove('open');
}

function closeJiraDropdown() {
    const dropdown = document.getElementById('jira-dropdown');
    if (dropdown) dropdown.classList.remove('open');
}

// 核心提单逻辑
async function copyAndOpenJira() {
    const wantCurrent = document.getElementById('jira-check-current').checked;
    const wantReport  = document.getElementById('jira-check-report').checked;
    const wantOrigin  = document.getElementById('jira-check-origin').checked;

    if (!wantCurrent && !wantReport && !wantOrigin) {
        alert('请至少选择一项提交内容');
        return;
    }

    const issueCount = parseInt(document.getElementById('iss-count')?.innerText || '0');
    if (issueCount === 0) {
        alert('⚠️ 当前没有标记任何问题，请先添加跑查标记！');
        return;
    }

    try {
        const btn = document.querySelector('#jira-dropdown .export-confirm-btn');
        let originalText = '确认并去提单';
        if (btn) { originalText = btn.innerText; btn.innerText = '⏳ 正在生成...'; btn.disabled = true; }

        const expCur = document.getElementById('exp-check-current');
        const expRep = document.getElementById('exp-check-report');
        const expOri = document.getElementById('exp-check-origin');
        const backup = { cur: expCur?.checked ?? true, rep: expRep?.checked ?? true, ori: expOri?.checked ?? false };

        if (expCur) expCur.checked = wantCurrent;
        if (expRep) expRep.checked = wantReport;
        if (expOri) expOri.checked = wantOrigin;

        const finalCanvas = typeof getFinalExportCanvas === 'function' ? getFinalExportCanvas() : null;

        if (expCur) expCur.checked = backup.cur;
        if (expRep) expRep.checked = backup.rep;
        if (expOri) expOri.checked = backup.ori;

        if (!finalCanvas) throw new Error('生成图片失败，可能是没有画面内容。');

        finalCanvas.toBlob(async (blob) => {
            try {
                await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
                if (btn) { btn.innerText = originalText; btn.disabled = false; }
                closeJiraDropdown();
                alert('✅ 跑查报告已根据您的选择复制成功！\n\n点击【确定】为您打开 Jira。\n请在新页面的「描述」框中直接按下 【Ctrl + V】 粘贴。');
                // 读取用户配置的 Jira 地址（无硬编码）
                window.open(getLinkConfig().jira, '_blank');
            } catch (clipboardErr) {
                console.error(clipboardErr);
                if (btn) { btn.innerText = originalText; btn.disabled = false; }
                alert('❌ 写入剪贴板失败！\n请确保网页是通过 HTTPS 或 http://localhost 访问的。');
            }
        }, 'image/png');

    } catch (err) {
        console.error(err);
        alert('❌ 发生错误：' + err.message);
    }
}

document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('jira-dropdown');
    const container = dropdown ? dropdown.parentElement : null;
    if (dropdown && dropdown.classList.contains('open')) {
        if (!dropdown.contains(e.target) && !container.contains(e.target)) {
            closeJiraDropdown();
        }
    }
});