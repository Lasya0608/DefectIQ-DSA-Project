/* ==========================================================
   JOSHIKA - MANUFACTURING QUALITY DASHBOARD
   Dashboard Interactions, API Requests, CSV Handling
   and Chart Rendering
   ========================================================== */

// ==========================================================
// 1. GLOBAL VARIABLES AND HELPER FUNCTIONS
// ==========================================================

let records = [];
let selected = [0, 0];

const $ = id => document.getElementById(id);

const fmt = n => Number(n).toLocaleString();


// ==========================================================
// 2. API REQUEST HANDLER
// ==========================================================

async function api(path, data) {
    const opts = data === undefined
        ? {}
        : {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        };

    const r = await fetch(path, opts);
    const j = await r.json();

    if (!r.ok) {
        throw Error(j.error || 'Request failed');
    }

    return j;
}


// ==========================================================
// 3. HTML ESCAPING FUNCTION
// ==========================================================

function escapeHtml(s) {
    return String(s).replace(
        /[&<>"']/g,
        c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[c])
    );
}


// ==========================================================
// 4. DASHBOARD RENDERING
// ==========================================================

// Render inspection totals, records, highlighted query
// range and chart.

function render() {
    let inspected = records.reduce(
        (s, r) => s + r.inspected,
        0
    );

    let defects = records.reduce(
        (s, r) => s + r.defects,
        0
    );

    // Update dashboard statistics
    $('totalRecords').textContent = fmt(records.length);
    $('totalInspected').textContent = fmt(inspected);
    $('totalDefects').textContent = fmt(defects);

    $('defectRate').textContent =
        (100 * defects / inspected).toFixed(2) + '%';

    // Update range input limits
    $('right').max = records.length - 1;
    $('left').max = records.length - 1;

    // Render inspection records
    $('rows').innerHTML = records.map((r, i) => `
        <tr class="${
            i >= selected[0] && i <= selected[1]
                ? 'selected'
                : ''
        }">
            <td>${i}</td>
            <td>${escapeHtml(r.date)}</td>
            <td>${escapeHtml(r.shift)}</td>
            <td>${escapeHtml(r.line)}</td>
            <td>${fmt(r.inspected)}</td>

            <td class="${
                r.defects > Number($('threshold').value)
                    ? 'danger'
                    : ''
            }">
                ${fmt(r.defects)}
            </td>

            <td>
                ${(100 * r.defects / r.inspected).toFixed(1)}%
            </td>
        </tr>
    `).join('');

    draw();
}


// ==========================================================
// 5. CHART RENDERING
// ==========================================================

// Plot defect counts and visually highlight the
// inclusive selected range.

function draw() {
    const c = $('chart');
    const ctx = c.getContext('2d');

    const w = c.width;
    const h = c.height;
    const p = 35;

    ctx.clearRect(0, 0, w, h);

    if (!records.length) {
        return;
    }

    let max = Math.max(
        1,
        ...records.map(r => r.defects)
    );

    // Draw grid lines
    ctx.strokeStyle = '#dbe5f0';
    ctx.lineWidth = 1;
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#71849a';

    for (let j = 0; j <= 4; j++) {
        let y = p + (h - 2 * p) * j / 4;

        ctx.beginPath();
        ctx.moveTo(p, y);
        ctx.lineTo(w - p, y);
        ctx.stroke();

        ctx.fillText(
            Math.round(max * (1 - j / 4)),
            4,
            y + 4
        );
    }

    // Calculate chart coordinates
    let step = (w - 2 * p) /
        Math.max(1, records.length - 1);

    let x = i => p + i * step;

    let y = v =>
        h - p - v / max * (h - 2 * p);

    // Highlight selected range
    ctx.fillStyle = '#e5f1ff';

    ctx.fillRect(
        x(selected[0]) - step / 2,
        p,
        Math.max(
            step,
            x(selected[1]) - x(selected[0]) + step
        ),
        h - 2 * p
    );

    // Draw defect line chart
    ctx.beginPath();

    records.forEach((r, i) => {
        if (i) {
            ctx.lineTo(x(i), y(r.defects));
        } else {
            ctx.moveTo(x(i), y(r.defects));
        }
    });

    ctx.strokeStyle = '#1768d1';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw data points
    if (records.length <= 100) {
        records.forEach((r, i) => {
            ctx.beginPath();

            ctx.arc(
                x(i),
                y(r.defects),
                3,
                0,
                2 * Math.PI
            );

            ctx.fillStyle = '#1768d1';
            ctx.fill();
        });
    }

    // Draw X-axis labels
    ctx.fillStyle = '#71849a';

    ctx.fillText('0', p, h - 8);

    ctx.fillText(
        String(records.length - 1),
        w - p - 25,
        h - 8
    );
}


// ==========================================================
// 6. RANGE QUERY ANALYSIS
// ==========================================================

// Send a range query to the backend DST endpoint.
// The algorithm remains in dst.py.

async function analyze() {
    try {
        let left = Number($('left').value);
        let right = Number($('right').value);

        // Validate indices
        if (
            !$('left').value ||
            !$('right').value ||
            !Number.isInteger(left) ||
            !Number.isInteger(right)
        ) {
            throw Error('Enter valid integer indices');
        }

        // Request DST range analysis
        const r = await api('/api/query', {
            left,
            right
        });

        selected = [left, right];

        // Display minimum and maximum values
        $('minValue').textContent = r.minimum;
        $('maxValue').textContent = r.maximum;

        $('rangeNote').textContent =
            `Analyzed ${r.count} records, ` +
            `indices ${left}–${right}, ` +
            `using precomputed DST aggregates.`;

        checkThreshold();
        render();

        $('message').textContent = '';

    } catch (e) {
        $('message').textContent = e.message;
    }
}


// ==========================================================
// 7. DEFECT THRESHOLD CHECKING
// ==========================================================

// Compare defect counts against the selected
// quality threshold.

function checkThreshold() {
    let t = Number($('threshold').value);

    // Validate threshold
    if (
        !$('threshold').value ||
        !Number.isInteger(t) ||
        t < 0
    ) {
        $('message').textContent =
            'Threshold must be a nonnegative integer';

        return;
    }

    // Find records exceeding threshold
    let breaches = records
        .map((r, i) => ({
            ...r,
            index: i
        }))
        .filter(r => r.defects > t);

    // Find breaches within selected range
    let inRange = breaches.filter(
        r =>
            r.index >= selected[0] &&
            r.index <= selected[1]
    );

    // Display threshold summary
    $('thresholdSummary').style.display = 'block';

    $('thresholdSummary').className =
        'alert ' + (breaches.length ? '' : 'good');

    $('thresholdSummary').textContent =
        `${breaches.length} of ${records.length} ` +
        `records exceed ${t} defects; ` +
        `${inRange.length} are in the selected range.`;

    // Display selected range alert
    $('alert').style.display = 'block';

    let max = Number($('maxValue').textContent);

    $('alert').className =
        'alert ' + (max <= t ? 'good' : '');

    $('alert').textContent = Number.isFinite(max)
        ? (
            max > t
                ? '⚠ Selected range exceeds the defect threshold.'
                : '✓ Selected range is within the defect threshold.'
        )
        : 'Analyze a range to check its maximum.';

    render();
}


// ==========================================================
// 8. LOAD DASHBOARD DATA
// ==========================================================

async function load() {
    let j = await api('/api/data');

    records = j.records;

    selected = [
        0,
        Math.min(10, records.length - 1)
    ];

    $('left').value = 0;
    $('right').value = selected[1];

    await analyze();
}


// ==========================================================
// 9. ANALYZE BUTTON EVENT
// ==========================================================

$('analyze').onclick = analyze;


// ==========================================================
// 10. THRESHOLD EVENT HANDLERS
// ==========================================================

$('check').onclick = checkThreshold;

$('threshold').onchange = checkThreshold;


// ==========================================================
// 11. RESET DATA EVENT
// ==========================================================

$('reset').onclick = async () => {
    try {
        records = (
            await api('/api/reset', {})
        ).records;

        await load();

    } catch (e) {
        $('message').textContent = e.message;
    }
};


// ==========================================================
// 12. CSV FILE UPLOAD
// ==========================================================

$('upload').onchange = async e => {
    let f = e.target.files[0];

    if (!f) {
        return;
    }

    try {
        // Upload CSV content to backend
        records = (
            await api('/api/upload', {
                csv: await f.text()
            })
        ).records;

        // Reset selected range
        selected = [
            0,
            Math.min(10, records.length - 1)
        ];

        $('left').value = 0;
        $('right').value = selected[1];

        await analyze();

        $('message').textContent =
            'CSV imported successfully';

    } catch (err) {
        $('message').textContent = err.message;
    }

    e.target.value = '';
};


// ==========================================================
// 13. CSV FILE DOWNLOAD
// ==========================================================

$('download').onclick = () => {
    const header =
        'date,shift,line,inspected,defects';

    // Convert records into CSV rows
    let lines = records.map(r =>
        [
            r.date,
            r.shift,
            r.line,
            r.inspected,
            r.defects
        ]
        .map(v =>
            '"' +
            String(v).replace(/"/g, '""') +
            '"'
        )
        .join(',')
    );

    // Create downloadable CSV file
    let a = document.createElement('a');

    a.href = URL.createObjectURL(
        new Blob(
            [[header, ...lines].join('\n')],
            { type: 'text/csv' }
        )
    );

    a.download = 'manufacturing_inspections.csv';

    // Trigger download
    a.click();

    // Release object URL
    setTimeout(
        () => URL.revokeObjectURL(a.href),
        1000
    );
};


// ==========================================================
// 14. INITIALIZE DASHBOARD
// ==========================================================

load().catch(
    e => $('message').textContent = e.message
);