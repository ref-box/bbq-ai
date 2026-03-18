/**
 * BBQ AI - アプリケーションロジック
 * BBQの買い出しリストを自動生成するWebアプリ
 */

'use strict';

// --- 定数：食材の単価目安（円） ---
const PRICES = {
    BEEF_100G: 350,
    PORK_100G: 200,
    CHICKEN_100G: 130,
    SAUSAGE_EACH: 60,
    VEG_SET: 500,
    DRINK_L: 150,
    ALCOHOL_ADD: 300,
    SEAFOOD_ADD: 400,
    RICE: 50,
    EQUIPMENT: 1500
};

// ==============================
// 初期化
// ==============================

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    loadListData();

    // URLパラメータから共有リストを復元
    const params = new URLSearchParams(window.location.search);
    const sharedList = params.get('list');
    if (sharedList) {
        try {
            const bytes = Uint8Array.from(atob(sharedList), c => c.charCodeAt(0));
            const json = new TextDecoder().decode(bytes);
            const d = JSON.parse(json);
            restoreListFromShareData({
                title: d.t || '',
                items: (d.i || []).map(item => ({ text: item.x, checked: !!item.c, isHeader: !!item.h }))
            });
        } catch (e) {
            console.error('共有URLの解析に失敗しました', e);
        }
    }

    // 設定入力の変更監視（自動保存）
    document.querySelectorAll('.card input, .card select').forEach(el => {
        el.addEventListener('change', saveData);
    });

    // チェックボックスラベルのUI更新
    const equipCheckbox = document.getElementById('equipment');
    if (equipCheckbox) {
        equipCheckbox.addEventListener('change', function() {
            this.closest('.checkbox-label').classList.toggle('checked', this.checked);
        });
    }
});

// ==============================
// 設定データの保存・復元
// ==============================

/** 設定データをlocalStorageに保存する */
function saveData() {
    const data = {
        men: document.getElementById('men').value,
        women: document.getElementById('women').value,
        kids: document.getElementById('kids').value,
        theme: document.getElementById('theme').value,
        equipment: document.getElementById('equipment').checked
    };
    localStorage.setItem('bbq_app_data_simple', JSON.stringify(data));
}

/** 設定データをlocalStorageから復元する */
function loadData() {
    const saved = localStorage.getItem('bbq_app_data_simple');
    if (!saved) return;

    const data = JSON.parse(saved);
    document.getElementById('men').value = data.men;
    document.getElementById('women').value = data.women;
    document.getElementById('kids').value = data.kids;
    document.getElementById('theme').value = data.theme;
    document.getElementById('equipment').checked = data.equipment;

    // チェックボックスラベルのUI同期
    if (data.equipment) {
        document.getElementById('equipment').closest('.checkbox-label').classList.add('checked');
    }
}

// ==============================
// リストデータの保存・復元
// ==============================

/** リストデータをlocalStorageに保存する */
function saveListData() {
    const rows = document.querySelectorAll('#listContainer .list-row');
    const titleEl = document.querySelector('#listContainer .list-title');
    const listData = [];

    rows.forEach(row => {
        const input = row.querySelector('input[type="text"]');
        const cb = row.querySelector('input[type="checkbox"]');
        listData.push({
            text: input.value,
            isHeader: input.classList.contains('header-text'),
            checked: cb ? cb.checked : false
        });
    });

    const fullData = {
        title: titleEl ? titleEl.textContent : '',
        budget: document.getElementById('budgetDisplay').textContent,
        totalBudget: document.getElementById('totalBudgetDisplay').textContent,
        items: listData,
        timestamp: Date.now()
    };

    localStorage.setItem('bbq_app_list_content', JSON.stringify(fullData));
}

/** リストデータをlocalStorageから復元する */
function loadListData() {
    const saved = localStorage.getItem('bbq_app_list_content');
    if (!saved) return;

    const data = JSON.parse(saved);
    const container = document.getElementById('listContainer');
    container.innerHTML = '';

    document.getElementById('resultArea').style.display = 'block';

    // タイトル復元
    if (data.title) {
        const titleDiv = document.createElement('div');
        titleDiv.className = 'list-title';
        titleDiv.textContent = data.title;
        container.appendChild(titleDiv);
    }

    // 予算復元
    if (data.budget) document.getElementById('budgetDisplay').textContent = data.budget;
    if (data.totalBudget) document.getElementById('totalBudgetDisplay').textContent = data.totalBudget;

    // リスト復元
    if (data.items && data.items.length > 0) {
        data.items.forEach(item => addNewRow(item.text, item.isHeader, item.checked));
    }
}

// ==============================
// ランダム食材候補プール（テーマ別）
// ==============================

/** 配列からランダムにn個を選ぶユーティリティ */
function pickRandom(arr, n) {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(n, arr.length));
}

// テーマ別の追加食材候補（ここからランダムに選ばれる）
const RANDOM_POOLS = {
    // 海鮮テーマ: 候補からランダムに3〜4品選出
    seafood: [
        { name: 'ホタテ', unit: '枚', perPerson: 1 },
        { name: '有頭エビ', unit: '尾', perPerson: 1.5 },
        { name: 'イカ', unit: '杯', perPerson: 0.3 },
        { name: 'サザエ', unit: '個', perPerson: 1 },
        { name: 'ハマグリ', unit: '個', perPerson: 2 },
        { name: 'アジの干物', unit: '枚', perPerson: 0.5 },
        { name: 'タコ串', unit: '本', perPerson: 1 },
        { name: 'サーモン切り身', unit: '切', perPerson: 1 },
        { name: 'エビ串', unit: '本', perPerson: 1 },
        { name: 'ホッケ干物', unit: '枚', perPerson: 0.3 },
    ],
    // お酒メインテーマ: おつまみ候補からランダムに3〜4品選出
    drinking: [
        { name: '枝豆', unit: '袋', perPerson: 0.3 },
        { name: 'チーズ盛り合わせ', unit: 'パック', perPerson: 0.2 },
        { name: 'アヒージョセット', unit: '人分', perPerson: 1 },
        { name: 'バゲット', unit: '本', perPerson: 0.3 },
        { name: '生ハム', unit: 'パック', perPerson: 0.3 },
        { name: 'カマンベールチーズ', unit: '個', perPerson: 0.2 },
        { name: 'ミックスナッツ', unit: '袋', perPerson: 0.2 },
        { name: 'サラミ', unit: '本', perPerson: 0.2 },
        { name: 'スモークチーズ', unit: 'パック', perPerson: 0.2 },
        { name: 'オリーブ', unit: '缶', perPerson: 0.2 },
    ],
    // コスパテーマ: サブ食材候補からランダムに2〜3品選出
    budget: [
        { name: '厚揚げ', unit: '丁', perPerson: 0.3 },
        { name: 'もやし', unit: '袋', perPerson: 0.3 },
        { name: '豆腐ステーキ用', unit: '丁', perPerson: 0.3 },
        { name: 'ちくわ', unit: '本', perPerson: 1 },
        { name: 'こんにゃく', unit: '枚', perPerson: 0.3 },
        { name: 'じゃがいも（ホイル焼き用）', unit: '個', perPerson: 0.5 },
        { name: 'さつまいも（ホイル焼き用）', unit: '本', perPerson: 0.3 },
        { name: 'もち', unit: '個', perPerson: 1 },
    ],
    // 肉食テーマ: 特別な肉候補からランダムに1〜2品選出
    meat: [
        { name: '牛タン', unit: 'g', perPerson: 50 },
        { name: 'スペアリブ', unit: '本', perPerson: 1 },
        { name: 'ラムチョップ', unit: '本', perPerson: 1 },
        { name: '手羽先', unit: '本', perPerson: 2 },
        { name: '厚切りベーコン', unit: '枚', perPerson: 1 },
        { name: 'ハラミ', unit: 'g', perPerson: 50 },
        { name: 'サムギョプサル用 豚バラ厚切り', unit: 'g', perPerson: 60 },
    ],
};

// テーマ別のランダム選出数
const RANDOM_PICK_COUNT = {
    seafood: 4,
    drinking: 4,
    budget: 3,
    meat: 2,
};

// ==============================
// リスト生成
// ==============================

/** テーマと人数に応じた買い物リストを生成する */
function generateList() {
    const men = parseInt(document.getElementById('men').value) || 0;
    const women = parseInt(document.getElementById('women').value) || 0;
    const kids = parseInt(document.getElementById('kids').value) || 0;
    const theme = document.getElementById('theme').value;
    const hasEquipment = document.getElementById('equipment').checked;
    const total = men + women + kids;

    if (total === 0) {
        showToast('人数を入力してください');
        return;
    }

    // テーマ別の計算パラメータ
    let meatPerPerson = 300;
    
    // 野菜の基本量（1人あたりの目安）
    let vegMultiplier = 1.0; 
    let riceMultiplier = 1.0;
    
    let extraItems = [];
    let themeTitle = '';
    let estimatedTotalCost = 0;

    switch (theme) {
        case 'standard':
            themeTitle = '定番';
            meatPerPerson = 300;
            break;
        case 'meat':
            themeTitle = '肉食';
            meatPerPerson = 450;
            vegMultiplier = 0.5; // 野菜少なめ
            // ランダムに特別な肉を追加
            if (RANDOM_POOLS.meat) {
                const picks = pickRandom(RANDOM_POOLS.meat, RANDOM_PICK_COUNT.meat);
                picks.forEach(item => {
                    const qty = Math.ceil(total * item.perPerson);
                    extraItems.push(`${item.name}: ${qty}${item.unit}`);
                });
            }
            break;
        case 'seafood':
            themeTitle = '海鮮';
            meatPerPerson = 200;
            // ランダムに海鮮アイテムを追加
            if (RANDOM_POOLS.seafood) {
                const picks = pickRandom(RANDOM_POOLS.seafood, RANDOM_PICK_COUNT.seafood);
                picks.forEach(item => {
                    const qty = Math.ceil(total * item.perPerson);
                    extraItems.push(`${item.name}: ${qty}${item.unit}`);
                });
            }
            estimatedTotalCost += total * PRICES.SEAFOOD_ADD;
            break;
        case 'budget':
            themeTitle = 'コスパ';
            meatPerPerson = 250;
            riceMultiplier = 1.5; // 焼きそば等多め
            // ランダムにコスパ食材を追加
            if (RANDOM_POOLS.budget) {
                const picks = pickRandom(RANDOM_POOLS.budget, RANDOM_PICK_COUNT.budget);
                picks.forEach(item => {
                    const qty = Math.ceil(total * item.perPerson);
                    extraItems.push(`${item.name}: ${qty}${item.unit}`);
                });
            }
            break;
        case 'drinking':
            themeTitle = 'お酒メイン';
            meatPerPerson = 200;
            riceMultiplier = 0; // 主食なし
            // ランダムにおつまみを追加
            if (RANDOM_POOLS.drinking) {
                const picks = pickRandom(RANDOM_POOLS.drinking, RANDOM_PICK_COUNT.drinking);
                picks.forEach(item => {
                    const qty = Math.ceil(total * item.perPerson);
                    extraItems.push(`${item.name}: ${qty}${item.unit}`);
                });
            }
            estimatedTotalCost += total * PRICES.ALCOHOL_ADD;
            break;
    }

    // 肉量の計算（男性100%、女性80%、子供60%）
    const totalMeatG = (men * meatPerPerson) + (women * meatPerPerson * 0.8) + (kids * meatPerPerson * 0.6);
    const beef = Math.round(totalMeatG * 0.4 / 100) * 100;
    const pork = Math.round(totalMeatG * 0.3 / 100) * 100;
    const chicken = Math.round(totalMeatG * 0.3 / 100) * 100;
    const drinkL = total * 2;

    // 具体的な野菜・主食の計算
    const onion = Math.ceil((total * 0.3) * vegMultiplier);
    const greenPepper = Math.ceil((total * 0.8) * vegMultiplier);
    const cabbage = Math.ceil((total * 0.15) * vegMultiplier);
    const mushroom = Math.ceil((total * 0.4) * vegMultiplier);

    const yakisoba = Math.ceil((total * 0.6) * riceMultiplier);
    const onigiri = Math.ceil((total * 1.0) * riceMultiplier);

    // リストアイテム構築
    const listItems = [
        `■ お肉 (約${(totalMeatG / 1000).toFixed(1)}kg)`,
        `牛肉: ${beef}g`,
        `豚肉: ${pork}g`,
        `鶏肉: ${chicken}g`,
        `ソーセージ: ${total * 2}本`,
        `■ 野菜・キノコ類`,
    ];

    if (vegMultiplier > 0) {
        listItems.push(
            `玉ねぎ: ${onion}個`,
            `ピーマン: ${greenPepper}個`,
            `キャベツ（またはカット野菜）: ${cabbage > 0 ? cabbage + '玉分' : '少々'}`,
            `エリンギ・しいたけ: ${mushroom}パック`
        );
    } else {
        listItems.push(`野菜なし設定`);
    }

    if (riceMultiplier > 0) {
        listItems.push(
            `■ 主食`,
            `焼きそば麺: ${yakisoba}玉`,
            `おにぎり（焼き用）: ${onigiri}個`
        );
    }

    listItems.push(`焼肉のタレ: ${Math.ceil(total / 5)}本`);

    if (extraItems.length > 0) {
        listItems.push('■ テーマ追加');
        extraItems.forEach(item => listItems.push(item));
    }

    listItems.push(
        '■ 飲み物・他',
        `ドリンク: 目安${drinkL}L`,
        `氷: ${Math.ceil(total / 3)}kg`,
        `皿・箸・コップ: ${total}人分`,
        'ゴミ袋: 3枚'
    );

    if (hasEquipment) {
        let charcoal = Math.ceil(total * 0.8);
        if (charcoal < 3) charcoal = 3;
        listItems.push(
            '■ 機材（持参）',
            `木炭: ${charcoal}kg`,
            '着火剤・ライター',
            '網・トング・軍手',
            'ホイル・キッチンペーパー'
        );
        estimatedTotalCost += PRICES.EQUIPMENT;
    }

    // 予算計算（肉種類別）
    estimatedTotalCost += (beef / 100) * PRICES.BEEF_100G;
    estimatedTotalCost += (pork / 100) * PRICES.PORK_100G;
    estimatedTotalCost += (chicken / 100) * PRICES.CHICKEN_100G;
    estimatedTotalCost += (total * 2) * PRICES.SAUSAGE_EACH;
    estimatedTotalCost += Math.ceil(total / 3) * PRICES.VEG_SET;
    estimatedTotalCost += drinkL * PRICES.DRINK_L;
    if (theme !== 'drinking') estimatedTotalCost += total * PRICES.RICE;

    const perPerson = Math.ceil((estimatedTotalCost / total) / 100) * 100;
    const totalDisplay = Math.ceil(estimatedTotalCost / 100) * 100;

    // DOM構築
    const container = document.getElementById('listContainer');
    container.innerHTML = '';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'list-title';
    titleDiv.textContent = `${themeTitle}リスト (${total}名)`;
    container.appendChild(titleDiv);

    listItems.forEach(text => {
        addNewRow(text, text.startsWith('■'));
    });

    document.getElementById('budgetDisplay').textContent = `1人 @${perPerson.toLocaleString()}円`;
    document.getElementById('totalBudgetDisplay').textContent = `合計: ${totalDisplay.toLocaleString()}円`;

    const resultArea = document.getElementById('resultArea');
    resultArea.style.display = 'block';
    resultArea.scrollIntoView({ behavior: 'smooth' });

    // 機材レンタルのアフィリエイト広告制御
    const rentalAd = document.getElementById('rentalAd');
    if (rentalAd) {
        rentalAd.style.display = hasEquipment ? 'block' : 'none';
    }

    // 再生成ボタンを表示
    const regenBtn = document.getElementById('regenerateBtn');
    if (regenBtn) regenBtn.style.display = 'block';

    saveListData();
    showToast('リストを生成しました');
}

// ==============================
// リスト行の操作
// ==============================

/** リストに行を追加する */
function addNewRow(initialText = '', isHeader = false, isChecked = false) {
    const container = document.getElementById('listContainer');
    const row = document.createElement('div');
    row.className = 'list-row';
    if (isChecked) row.classList.add('checked');

    if (!isHeader) {
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = isChecked;
        cb.addEventListener('change', function() {
            row.classList.toggle('checked', this.checked);
            saveListData();
        });
        row.appendChild(cb);
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.value = initialText;
    if (isHeader) input.classList.add('header-text');
    input.addEventListener('input', saveListData);
    row.appendChild(input);

    const delBtn = document.createElement('button');
    delBtn.textContent = '✕';
    delBtn.className = 'del-btn';
    delBtn.onclick = () => {
        row.remove();
        saveListData();
    };
    row.appendChild(delBtn);

    container.appendChild(row);
}

// ==============================
// テキスト出力・共有
// ==============================

/** リストをテキスト文字列に変換する */
function getListText() {
    const rows = document.querySelectorAll('#listContainer .list-row');
    const titleEl = document.querySelector('#listContainer .list-title');
    let text = (titleEl ? titleEl.textContent : 'BBQリスト') + '\n\n';

    rows.forEach(row => {
        const input = row.querySelector('input[type="text"]');
        const cb = row.querySelector('input[type="checkbox"]');
        if (cb) {
            text += (cb.checked ? '✅ ' : '□ ') + input.value + '\n';
        } else {
            text += '【' + input.value.replace('■ ', '') + '】\n';
        }
    });

    const budget = document.getElementById('budgetDisplay').textContent;
    const totalBudget = document.getElementById('totalBudgetDisplay').textContent;
    text += `\n💰 ${budget} (${totalBudget})`;

    return text;
}

/** リストをクリップボードにコピーする */
function copyText() {
    navigator.clipboard.writeText(getListText()).then(() => {
        showToast('コピーしました');
    });
}

/** リストをLINEで送信する（テキストのみ） */
function sendLine() {
    const url = `https://line.me/R/msg/text/?${encodeURIComponent(getListText())}`;
    window.open(url, '_blank');
}

/** 
 * リストをURLとして共有（コピー）する機能 
 * 現在のリスト内容とチェック状態をJSON化してURLパラメータに付与します
 */
window.shareListURL = function() {
    const container = document.getElementById('listContainer');
    
    // 現在描画されているリストを抽出
    const shareData = {
        title: "",
        items: []
    };

    const titleEl = container.querySelector('.list-title');
    if (titleEl) shareData.title = titleEl.textContent;

    const rows = container.querySelectorAll('.list-row');
    rows.forEach(row => {
        const textInput = row.querySelector('input[type="text"]');
        const checkbox = row.querySelector('input[type="checkbox"]');
        
        if (textInput && textInput.value) {
            shareData.items.push({
                text: textInput.value,
                checked: checkbox ? checkbox.checked : false,
                isHeader: row.classList.contains('header-row') || textInput.value.startsWith('■')
            });
        }
    });

    if (shareData.items.length === 0) {
        alert('共有するリストがありません。');
        return;
    }

    // キーを短縮してBase64エンコード（URLを短縮するため）
    const shortData = {
        t: shareData.title,
        i: shareData.items.map(item => ({ x: item.text, c: item.checked ? 1 : 0, h: item.isHeader ? 1 : 0 }))
    };
    const bytes = new TextEncoder().encode(JSON.stringify(shortData));
    const encodedData = btoa(String.fromCharCode(...bytes));

    // 現在のベースURLを取得（パラメータを取り除く）
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?list=${encodedData}`;

    // スマホのWeb Share APIが使える場合はそちらを優先、なければクリップボードコピー
    if (navigator.share) {
        navigator.share({
            title: 'BBQ買い出しリスト',
            text: 'BBQの買い出しリストを共有します！タップして各自のスマホでチェックできます👍\n',
            url: shareUrl
        }).then(() => {
            showToast('共有メニューを開きました');
        }).catch((error) => {
            console.error('Error sharing', error);
            // 失敗時はコピーにフォールバック
            fallbackCopy(shareUrl);
        });
    } else {
        fallbackCopy(shareUrl);
    }
}

/** コピー処理のフォールバック */
function fallbackCopy(url) {
    const textToCopy = `BBQ買い出しリストを共有します！タップして各自のスマホでチェック可能✏️\n${url}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('共有URLをコピーしました！LINE等に貼り付けてください');
    }).catch(err => {
        console.error('コピー失敗', err);
        alert('コピーに失敗しました。');
    });
}

/** 共有URLから受け取ったリストデータで画面を再構築する */
function restoreListFromShareData(data) {
    const container = document.getElementById('listContainer');
    container.innerHTML = '';
    
    if (data.title) {
        const titleDiv = document.createElement('div');
        titleDiv.className = 'list-title';
        titleDiv.textContent = data.title;
        container.appendChild(titleDiv);
    }
    
    data.items.forEach(item => {
        addNewRow(item.text, item.isHeader, item.checked);
    });

    // 復元したデータをローカルストレージに保存（次回以降のアクセス用）
    saveListData();

    // 他のUI要素（金額など）は共有情報に含まれないため表示をリセット
    const budgetDisplay = document.getElementById('budgetDisplay');
    if (budgetDisplay) budgetDisplay.textContent = "URLから共有されたリストです";
    const totalBudgetDisplay = document.getElementById('totalBudgetDisplay');
    if (totalBudgetDisplay) totalBudgetDisplay.textContent = "";

    // 結果領域を表示してスクロール
    const resultArea = document.getElementById('resultArea');
    if (resultArea) {
        resultArea.style.display = 'block';
        setTimeout(() => {
            resultArea.scrollIntoView({ behavior: 'smooth' });
        }, 300);
    }
    
    showToast('共有されたリストを読み込みました');
}

// ==============================
// リセット機能
// ==============================

/** リセット確認ダイアログを表示する */
function showResetConfirm() {
    document.getElementById('resetModal').classList.add('active');
}

/** リセット確認ダイアログを閉じる */
function hideResetConfirm() {
    document.getElementById('resetModal').classList.remove('active');
}

/** リセットを実行する */
function executeReset() {
    // localStorageのデータを削除
    localStorage.removeItem('bbq_app_data_simple');
    localStorage.removeItem('bbq_app_list_content');

    // 入力をデフォルトに戻す
    document.getElementById('men').value = 0;
    document.getElementById('women').value = 0;
    document.getElementById('kids').value = 0;
    document.getElementById('theme').value = 'standard';
    document.getElementById('equipment').checked = false;

    const label = document.getElementById('equipmentLabel');
    if (label) label.classList.remove('checked');

    // 結果エリアを非表示にする
    document.getElementById('resultArea').style.display = 'none';
    document.getElementById('listContainer').innerHTML = '';

    // モーダルを閉じる
    hideResetConfirm();
    showToast('リセットしました');
}

// ==============================
// ユーティリティ
// ==============================

/** トースト通知を表示する */
function showToast(message) {
    // 既存のトーストを削除
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 2500);
}
