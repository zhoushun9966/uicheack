'use strict';

// 💡 唯一需要修改的地方：改成你们公司的 Jira 域名
const JIRA_URL = "http://jira.sanguosha.com:8080/secure/Dashboard.jspa/secure/CreateIssue!default.jspa/secure/CreateIssue!default.jspa"; 

// 控制 Jira 下拉菜单的开关
function toggleJiraDropdown() {
    document.getElementById('jira-dropdown').classList.toggle('open');
    // 如果普通的导出菜单开着，就把它关掉，避免重叠
    const expDropdown = document.getElementById('export-dropdown');
    if (expDropdown) expDropdown.classList.remove('open');
}

function closeJiraDropdown() {
    const dropdown = document.getElementById('jira-dropdown');
    if (dropdown) dropdown.classList.remove('open');
}

// 核心提单逻辑
async function copyAndOpenJira() {
    // 1. 获取 Jira 菜单里的勾选状态
    const wantCurrent = document.getElementById('jira-check-current').checked;
    const wantReport = document.getElementById('jira-check-report').checked;
    const wantOrigin = document.getElementById('jira-check-origin').checked;

    if (!wantCurrent && !wantReport && !wantOrigin) {
        alert('请至少选择一项提交内容');
        return;
    }

    const issueCountElement = document.getElementById('iss-count');
    const issueCount = issueCountElement ? issueCountElement.innerText : '0';

    if (parseInt(issueCount) === 0) {
        alert("⚠️ 当前没有标记任何问题，请先添加跑查标记！");
        return;
    }

    try {
        const btn = document.querySelector('#jira-dropdown .export-confirm-btn');
        let originalText = "确认并去提单";
        if (btn) {
            originalText = btn.innerText;
            btn.innerText = "⏳ 正在生成...";
            btn.disabled = true;
        }

        // --- 核心：临时借用 08-export.js 的配置生成长图 ---
        // 先保存用户在「导出报告」里的原本选择
        const expCur = document.getElementById('exp-check-current');
        const expRep = document.getElementById('exp-check-report');
        const expOri = document.getElementById('exp-check-origin');

        const backup = {
            cur: expCur ? expCur.checked : true,
            rep: expRep ? expRep.checked : true,
            ori: expOri ? expOri.checked : false
        };

        // 将选择强制替换为用户在 Jira 菜单里的选择
        if (expCur) expCur.checked = wantCurrent;
        if (expRep) expRep.checked = wantReport;
        if (expOri) expOri.checked = wantOrigin;

        // 调用 08-export.js 的函数，拿到完美的组合画板
        const finalCanvas = typeof getFinalExportCanvas === 'function' ? getFinalExportCanvas() : null;

        // 生成完毕后，把「导出报告」的勾选状态恢复原样
        if (expCur) expCur.checked = backup.cur;
        if (expRep) expRep.checked = backup.rep;
        if (expOri) expOri.checked = backup.ori;
        // ----------------------------------------------------

        if (!finalCanvas) {
            throw new Error("生成图片失败，可能是没有画面内容。");
        }

        // 转为 Blob 并塞进剪贴板
        finalCanvas.toBlob(async (blob) => {
            try {
                const clipboardItem = new ClipboardItem({ [blob.type]: blob });
                await navigator.clipboard.write([clipboardItem]);

                if (btn) {
                    btn.innerText = originalText;
                    btn.disabled = false;
                }
                closeJiraDropdown();

                alert("✅ 跑查报告已根据您的选择复制成功！\n\n点击【确定】为您打开 Jira。\n请在新页面的「描述」框中直接按下 【Ctrl + V】 粘贴。");
                
                window.open(`${JIRA_URL}/secure/CreateIssue!default.jspa`, '_blank');

            } catch (clipboardErr) {
                console.error(clipboardErr);
                if (btn) { btn.innerText = originalText; btn.disabled = false; }
                alert("❌ 写入剪贴板失败！\n请确保网页是通过 HTTPS 或 http://localhost 访问的。");
            }
        }, 'image/png');

    } catch (err) {
        console.error(err);
        alert("❌ 发生错误：" + err.message);
    }
}

// 优化体验：点击网页空白处自动收起 Jira 下拉菜单
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('jira-dropdown');
    // 获取包含按钮的父容器
    const container = dropdown ? dropdown.parentElement : null;
    
    if (dropdown && dropdown.classList.contains('open')) {
        // 如果点击的区域不在菜单内，也不在按钮区域内，就收起菜单
        if (!dropdown.contains(e.target) && !container.contains(e.target)) {
            closeJiraDropdown();
        }
    }
});