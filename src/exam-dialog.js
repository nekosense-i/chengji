/* Keep the original point value until the displayed input is edited. */
UI.prototype._readExamQuestionMax = function(input) {
    return Number(input?.dataset.exactMax ?? input?.value);
};

(() => {
    const format = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2, useGrouping: false });
    const sync = UI.prototype._syncQuestionRows;
    UI.prototype._syncQuestionRows = function(listId = 'q-list') {
        sync.call(this, listId);
        if (listId !== 'q-list' && listId !== 'edit-q-list') return;
        const list = document.getElementById(listId);
        const rows = list.querySelectorAll('.q-row');
        let questions = 0;
        let points = 0;
        for (const row of rows) {
            const max = row.querySelector('.qs');
            if (!max.dataset.displayReady) {
                max.dataset.displayReady = 'true';
                const exact = Number(max.value);
                if (exact >= 0.01 && format.format(exact) !== max.value) {
                    max.dataset.exactMax = max.value;
                    max.value = format.format(exact);
                }
                // Capture runs before the existing inline input handler recomputes totals.
                max.addEventListener('input', () => delete max.dataset.exactMax, true);
            }
            points += this._readExamQuestionMax(max) || 0;

            const count = row.querySelector('.q-count');
            if (row.querySelector('.q-manual').checked) {
                count.dataset.manualCount ??= count.value;
                count.value = '';
                count.placeholder = '—';
            } else {
                if (count.dataset.manualCount !== undefined) {
                    count.value = count.dataset.manualCount;
                    delete count.dataset.manualCount;
                }
                count.placeholder = '题数';
                questions += Number(count.value) || 0;
            }
        }
        document.getElementById(`${listId}-total`).textContent =
            `共 ${rows.length} 项 · ${questions} 题 · 满分 ${format.format(points)} 分`;
    };
})();
