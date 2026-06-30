const IS_DEBUG = new URLSearchParams(window.location.search).has('debug');
let charIndex = 0;
let overloadData = {};
let equipData = {};

const fetchOverload = fetch('overload.json')                                                                                                                 
  .then(r => r.json())                                                                                                                                       
  .then(data => { overloadData = data; });                                                                                                                   
                                                                                                                                                              
const fetchEquipment = fetch('equipment.json')                                                                                                               
  .then(r => r.json())                                                                                                                                       
  .then(data => { equipData = data; });                                                                                                                      
                                                                                                                                                              
Promise.all([fetchOverload, fetchEquipment]).then(() => {                                                                                                    
  loadFromLocalStorage();
});

const EQUIP_PARTS = [
  { key: 'head', label: '頭' },
  { key: 'torso', label: '胴' },
  { key: 'arms', label: '腕' },
  { key: 'legs', label: '脚' },
];

const OVERLOAD_OPTIONS = [
  { value: 'ElemDamage', label: '有利コードダメージ増加' },
  { value: 'HitRate', label: '命中率増加' },
  { value: 'MaxAmmo', label: '最大装弾数増加' },
  { value: 'ATK', label: '攻撃力増加' },
  { value: 'ChargeDamage', label: 'チャージダメージ増加' },
  { value: 'ChargeSpeed', label: 'チャージ速度増加' },
  { value: 'CritDamage', label: 'クリティカルダメージ増加' },
  { value: 'CritRate', label: 'クリティカル率増加' },
  { value: 'DEF', label: '防御力増加' },
];

const OVERLOAD_KEY_MAP = {};
for (const opt of OVERLOAD_OPTIONS) {
  OVERLOAD_KEY_MAP[opt.value] = opt.label;
}

const CORP_LABELS = {
  elysion: 'エリシオン',
  missilis: 'ミシリス',
  tetra: 'テトラ',
  abnormal: 'アブノーマル',
  pilgrim: 'ピルグリム'
};

function buildOverloadSlot(idPrefix) {
  const typeOptions = OVERLOAD_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('');

  return `
    <div class="overload-slot">
      <select id="${idPrefix}-type">
        <option value="">なし</option>
        ${typeOptions}
      </select>
      <select id="${idPrefix}-level" disabled>
        <option value="0">-</option>
      </select>
    </div>
  `;
}

function buildEquipFieldset(index) {
  let html = '<fieldset><legend>装備</legend>';
  for (const part of EQUIP_PARTS) {
    html += `<fieldset><legend>${part.label}</legend>`;
    html += `
      <div>
        <label>TIER
          <select id="char-${index}-equip-${part.key}-tier">
            <option value="0">なし</option>
            ${Array.from({length: 10}, (_, i) => `<option value="${10-i}">T${10-i}</option>`).join('')}
          </select>
        </label>
        <label>Lv
          <select id="char-${index}-equip-${part.key}-level" disabled>
            <option value="0">0</option>
          </select>
        </label>
      </div>
      <div id="char-${index}-equip-${part.key}-overload" style="display:none; margin-top:8px;">
    `;
    for (let slot = 0; slot < 3; slot++) {
      html += buildOverloadSlot(`char-${index}-ol-${part.key}-${slot}`);
    }
    html += '</div></fieldset>';
  }
  html += '</fieldset>';
  return html;
}

function setupOverloadSlots(detail, index, updatePower) {
  for (const part of EQUIP_PARTS) {
    const slotSelects = [];
    for (let slot = 0; slot < 3; slot++) {
      const prefix = `char-${index}-ol-${part.key}-${slot}`;
      slotSelects.push({
        typeSelect: detail.querySelector(`#${prefix}-type`),
        levelSelect: detail.querySelector(`#${prefix}-level`),
      });
    }

    // 同一部位内で選択済みオプションをdisabledにする
    function updateDisabledOptions() {
      const selected = slotSelects.map(s => s.typeSelect.value).filter(v => v);
      for (const { typeSelect } of slotSelects) {
        for (const opt of typeSelect.options) {
          if (!opt.value) continue; // 「なし」はスキップ
          opt.disabled = opt.value !== typeSelect.value && selected.includes(opt.value);
        }
      }
    }

    for (const { typeSelect, levelSelect } of slotSelects) {
      typeSelect.addEventListener('change', () => {
        const type = typeSelect.value;
        const jpType = OVERLOAD_KEY_MAP[type];
        // レベルselectの選択肢を再構築
        levelSelect.innerHTML = '<option value="0">-</option>';
        if (type && overloadData[jpType]) {
          for (const entry of overloadData[jpType]) {
            const opt = document.createElement('option');
            opt.value = entry.level;
            opt.textContent = entry.value;
            levelSelect.appendChild(opt);
          }
          levelSelect.disabled = false;
          levelSelect.value = '1';
        } else {
          levelSelect.disabled = true;
          levelSelect.value = '0';
        }
        updateDisabledOptions();
        updatePower();
      });

      levelSelect.addEventListener('change', () => {
        updatePower();
      });
    }
  }
}

function createCharCard(index, info) {
  const card = document.createElement('div');
  card.id = `char-${index}`;
  card.className = 'char-card';

  // ヘッダー（クリックで展開）
  const header = document.createElement('div');
  header.className = 'char-header';

  const title = document.createElement('strong');
  title.textContent = `${info.name} [${info.rarity}] ${CORP_LABELS[info.corp] || info.corp} / ${info.weapon} (${info.class === 'attacker' ? '火力型' : info.class === 'defender' ? '防御型' : '支援型'})`;
  header.addEventListener('click', () => {
    const detail = document.getElementById(`char-${index}-detail`);
    const isHidden = getComputedStyle(detail).display === 'none';
    detail.style.display = isHidden ? 'block' : 'none';
  });

  // 外部参照用の名前・レアリティ・型式・企業保持要素
  const nameInput = document.createElement('input');
  nameInput.type = 'hidden';
  nameInput.id = `char-${index}-name`;
  nameInput.value = info.name;
  header.appendChild(nameInput);

  const rarityInput = document.createElement('input');
  rarityInput.type = 'hidden';
  rarityInput.id = `char-${index}-rarity`;
  rarityInput.value = info.rarity;

  const classInput = document.createElement('input');
  classInput.type = 'hidden';
  classInput.id = `char-${index}-class`;
  classInput.value = info.class;

  const manufacturerInput = document.createElement('input');
  manufacturerInput.type = 'hidden';
  manufacturerInput.id = `char-${index}-manufacturer`;
  manufacturerInput.value = info.corp;

  const weaponInput = document.createElement('input');
  weaponInput.type = 'hidden';
  weaponInput.id = `char-${index}-weapon`;
  weaponInput.value = info.weapon;

  const powerLabel = document.createElement('span');
  powerLabel.id = `char-${index}-power`;
  powerLabel.textContent = '戦闘力: 0';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => {
    card.remove();
    saveToLocalStorage();
  });

  header.appendChild(title);
  header.appendChild(rarityInput);
  header.appendChild(classInput);
  header.appendChild(manufacturerInput);
  header.appendChild(weaponInput);
  header.appendChild(powerLabel);
  header.appendChild(removeBtn);

  // 詳細エリア（初期非表示）
  const detail = document.createElement('div');
  detail.id = `char-${index}-detail`;
  detail.className = 'char-detail';

  const maxDup = info.rarity === 'SR' ? 2 : (info.rarity === 'R' ? 0 : 10);

  const duplicateHtml = maxDup === 0
    ? `<span>強化不可</span><input type="hidden" id="char-${index}-duplicate" value="0">`
    : `
        <button type="button" class="duplicate-minus" data-index="${index}">－</button>
        <input type="hidden" id="char-${index}-duplicate" value="0">
        <span id="char-${index}-duplicate-display" class="duplicate-display">${duplicateDisplay(0)}</span>
        <button type="button" class="duplicate-plus" data-index="${index}">＋</button>
      `;

  detail.innerHTML = `
    <fieldset>
      <legend>限界突破</legend>
      <div>
        ${duplicateHtml}
      </div>
    </fieldset>
    <fieldset>
      <legend>スキルレベル</legend>
      <div>
        <label>スキル1 <input type="number" id="char-${index}-skill1" value="1" min="1" max="10" style="width:80px;"></label>
        <label>スキル2 <input type="number" id="char-${index}-skill2" value="1" min="1" max="10" style="width:80px;"></label>
        <label>バースト <input type="number" id="char-${index}-skill-burst" value="1" min="1" max="10" style="width:80px;"></label>
      </div>
    </fieldset>
    ${buildEquipFieldset(index)}
    <fieldset>
      <legend>コレクション</legend>
      <div>
        <label>種類
          <select id="char-${index}-collection-type">
            <option value="none">なし</option>
            <option value="R">R (ぬいぐるみ)</option>
            <option value="SR">SR (ぬいぐるみ)</option>
          </select>
        </label>
        <label>Lv
          <input type="number" id="char-${index}-collection-phase" value="0" min="0" max="15" style="width:80px;">
        </label>
      </div>
    </fieldset>
    <div>
      <label>キューブ
        <select id="char-${index}-cube-level">
          <option value="0" selected>なし</option>
          ${Array.from({length: 15}, (_, i) => `<option value="${i+1}">Lv.${i+1}</option>`).join('')}
        </select>
      </label>
    </div>
    <div>
      <label>好感度ランク
        <input type="number" id="char-${index}-bond" value="0" min="0" max="40" style="width:80px;">
      </label>
    </div>
    <fieldset ${IS_DEBUG ? '' : 'hidden'}>
      <legend>実際のステータス（デバッグ用）</legend>
      <div>
        <label>戦闘力 <input type="number" id="char-${index}-actual-power" value="" min="0" style="width:100px;"></label>
        <label>HP <input type="number" id="char-${index}-actual-hp" value="" min="0" style="width:100px;"></label>
        <label>攻撃力 <input type="number" id="char-${index}-actual-atk" value="" min="0" style="width:100px;"></label>
        <label>防御力 <input type="number" id="char-${index}-actual-def" value="" min="0" style="width:100px;"></label>
      </div>
    </fieldset>
  `;

  // 限界突破の±ボタン制御
  if (maxDup > 0) {
    const dupInput = detail.querySelector(`#char-${index}-duplicate`);
    const dupDisplay = detail.querySelector(`#char-${index}-duplicate-display`);

    detail.querySelector('.duplicate-minus').addEventListener('click', () => {
      const val = Math.max(0, Number(dupInput.value) - 1);
      dupInput.value = val;
      dupDisplay.textContent = duplicateDisplay(val);
      updatePower();
    });

    detail.querySelector('.duplicate-plus').addEventListener('click', () => {
      const val = Math.min(maxDup, Number(dupInput.value) + 1);
      dupInput.value = val;
      dupDisplay.textContent = duplicateDisplay(val);
      updatePower();
    });
  }

  // 装備Tier/Levelの制御
  for (const part of EQUIP_PARTS) {
    const tierSelect = detail.querySelector(`#char-${index}-equip-${part.key}-tier`);
    const levelSelect = detail.querySelector(`#char-${index}-equip-${part.key}-level`);
    const overloadDiv = detail.querySelector(`#char-${index}-equip-${part.key}-overload`);

    tierSelect.addEventListener('change', () => {
      const tier = Number(tierSelect.value);
      let maxLevel = 0;
      if (tier >= 7) maxLevel = 5;
      else if (tier >= 5) maxLevel = 4;
      else if (tier >= 3) maxLevel = 3;
      else maxLevel = 0;

      levelSelect.innerHTML = '';
      for (let i = 0; i <= maxLevel; i++) {
        levelSelect.innerHTML += `<option value="${i}">${i}</option>`;
      }
      levelSelect.disabled = maxLevel === 0;

      if (tier === 10) {
        overloadDiv.style.display = 'block';
      } else {
        overloadDiv.style.display = 'none';
        // オーバーロードのリセット
        for (let slot = 0; slot < 3; slot++) {
          const typeSelect = detail.querySelector(`#char-${index}-ol-${part.key}-${slot}-type`);
          if (typeSelect.value !== '') {
            typeSelect.value = '';
            typeSelect.dispatchEvent(new Event('change'));
          }
        }
      }
      updatePower();
    });

    levelSelect.addEventListener('change', updatePower);
  }

  // 詳細内のinput変更時に戦闘力を再計算
  function updatePower() {
    const power = calcPower(index, info.class);
    powerLabel.textContent = `戦闘力: ${power}`;
    saveToLocalStorage();
  }
  detail.addEventListener('input', updatePower);
  detail.addEventListener('change', updatePower);

  // オーバーロードスロットのイベント設定
  setupOverloadSlots(detail, index, updatePower);

  const colTypeSelect = detail.querySelector(`#char-${index}-collection-type`);
  const colPhaseSelect = detail.querySelector(`#char-${index}-collection-phase`);

  colTypeSelect.addEventListener('change', () => {
    const type = colTypeSelect.value;
    colPhaseSelect.innerHTML = '';
    const colPhaseSelectParent = colPhaseSelect.parentElement;

    if (type === 'none') {
      colPhaseSelectParent.disabled = true;
      colPhaseSelectParent.hidden = true;
    } else if (type === 'R' || type === 'SR') {
      colPhaseSelectParent.disabled = false;
      colPhaseSelectParent.hidden = false;
    } else if (type === 'SSR') {
      colPhaseSelectParent.disabled = true;
      colPhaseSelectParent.hidden = true;
    }
    updatePower(); // 変更時に戦闘力を再計算
  });

  // 段階/Lvが変更された時も再計算
  colPhaseSelect.addEventListener('change', updatePower);

  // cube
  const cubeLevel = detail.querySelector(`#char-${index}-cube-level`);
  cubeLevel.addEventListener('change', () => {
    updatePower();
  });

  // bond
  const bond = detail.querySelector(`#char-${index}-bond`);
  bond.addEventListener('change', () => {
    updatePower();
  });

  card.appendChild(header);
  card.appendChild(detail);
  card.updatePower = updatePower;
  return card;
}

// 限界突破の表示文字列
function duplicateDisplay(val) {
  if (val === 10) return '★★★ MAX';
  if (val <= 3) return '★'.repeat(val) || '—';
  return '★★★' + String(val - 3).padStart(2, '0');
}

const CP_COEF = 0.006900;

function roundHalfToOdd(x) {
  const f = Math.floor(x);
  const frac = x - f;
  if (Math.abs(frac - 0.5) < 1e-9) {
    // ちょうど 0.5: 奇数側に丸める
    return f % 2 === 1 ? f : f + 1;
  }
  return Math.round(x);
}

const RARITY_BASE_STAT_TABLE = {
  R: {
    HP: 11500,
    ATK: 400,
    DEF: 80,
  },
  SR: {
    HP: 11500,
    ATK: 450,
    DEF: 90,
  },
  SSR: {
    HP: 15000,
    ATK: 500,
    DEF: 100,
  }
}

const CLASS_MODIFIERS = {
  attacker: {
    HP: 0.9,
    ATK: 1.2,
    DEF: 0.9,
  },
  defender: {
    HP: 1.1,
    ATK: 0.8,
    DEF: 1.1,
  },
  supporter: {
    HP: 1.0,
    ATK: 1.0,
    DEF: 1.0,
  }
}

const WEAPON_DEF_MODIFIER = {
  AR: 1.00000,
  RL: 0.97555,
  SG: 0.960,
  SMG: 31.0 / 36.0,
  SR: 0.840,
  MG: 0.83655
}

const RARITY_OFFSET = {
  SR: {
    HP: 2300,
    ATK: 18,
    DEF: 90,
  },
  SSR: {
    HP: 3000,
    ATK: 20,
    DEF: 100,
  }
}

function calcBaseStats(index, charClass) {
  const level = 40;
  const duplicate = Number(document.getElementById(`char-${index}-duplicate`)?.value || 0);
  const rarity = document.getElementById(`char-${index}-rarity`)?.value;
  const manufacturer = document.getElementById(`char-${index}-manufacturer`)?.value;
  const weapon = document.getElementById(`char-${index}-weapon`)?.value;
  const bond = Number(document.getElementById(`char-${index}-bond`)?.value || 0);
  const general_research = Number(document.getElementById(`general-research`)?.value || 0);
  const class_research = Number(document.getElementById(`class-research-${charClass}`)?.value || 0);
  const manufacturer_research = Number(document.getElementById(`corp-research-${manufacturer}`)?.value || 0);

  const I = (cond) => {
    return +cond;
  };
  const k = (lv) => {
    return (lv - 1) + I(lv >= 11) + I(lv >= 21);
  };

  const lv1_hp_internal  = RARITY_BASE_STAT_TABLE[rarity].HP  * CLASS_MODIFIERS[charClass].HP;
  const lv1_atk_internal = RARITY_BASE_STAT_TABLE[rarity].ATK * CLASS_MODIFIERS[charClass].ATK;
  const lv1_def_internal = RARITY_BASE_STAT_TABLE[rarity].DEF * CLASS_MODIFIERS[charClass].DEF * WEAPON_DEF_MODIFIER[weapon];

  const base_hp_internal  = lv1_hp_internal  * (1 + k(level) / 20);
  const base_atk_internal = lv1_atk_internal * (1 + k(level) / 20);
  const base_def_internal = lv1_def_internal * (1 + k(level) / 20);

  const limit_break_count = Math.min(duplicate, 3);

  const rarityOffset = RARITY_OFFSET[rarity] || { HP: 0, ATK: 0, DEF: 0 };

  const limit_break_bonus_unit_hp  = rarityOffset.HP  + 0.02 * base_hp_internal;
  const limit_break_bonus_unit_atk = rarityOffset.ATK + 0.02 * base_atk_internal;
  const limit_break_bonus_unit_def = rarityOffset.DEF + 0.02 * base_def_internal;

  const limit_break_bonus_hp  = Math.floor(limit_break_count * limit_break_bonus_unit_hp);
  const limit_break_bonus_atk = Math.floor(limit_break_count * limit_break_bonus_unit_atk);
  const limit_break_bonus_def = Math.floor(limit_break_count * limit_break_bonus_unit_def);

  const hp_after_lb  = Math.round(base_hp_internal)  + limit_break_bonus_hp;
  const atk_after_lb = Math.round(base_atk_internal) + limit_break_bonus_atk;
  const def_after_lb = Math.round(base_def_internal) + limit_break_bonus_def;

  const bond_rate = 3.9 * Math.pow(Math.max(0, bond - 1) / 39, 1.2);

  const bond_base_hp  = 15000;
  const bond_base_atk = 500;
  const bond_base_def = 100;

  const pre_bond_hp  = Math.round(bond_base_hp  * bond_rate);
  const pre_bond_atk = Math.round(bond_base_atk * bond_rate);
  const pre_bond_def = Math.round(bond_base_def * bond_rate);

  const bond_hp  = Math.round(pre_bond_hp  * CLASS_MODIFIERS[charClass].HP);
  const bond_atk = Math.round(pre_bond_atk * CLASS_MODIFIERS[charClass].ATK);
  const bond_def = Math.round(pre_bond_def * CLASS_MODIFIERS[charClass].DEF);

  const research_bonus_hp  = general_research * 450 + class_research * 750;
  const research_bonus_atk = manufacturer_research * 25;
  const research_bonus_def = class_research * 5 + manufacturer_research * 5;

  const hp_subtotal  = hp_after_lb  + bond_hp  + research_bonus_hp;
  const atk_subtotal = atk_after_lb + bond_atk + research_bonus_atk;
  const def_subtotal = def_after_lb + bond_def + research_bonus_def;

  const core = Math.max(duplicate - 3, 0);

  const core_bonus_hp  = Math.round(hp_subtotal  * 0.02 * core);
  const core_bonus_atk = Math.round(atk_subtotal * 0.02 * core);
  const core_bonus_def = Math.round(def_subtotal * 0.02 * core);

  const final_hp   = hp_subtotal  + core_bonus_hp;
  const final_atk  = atk_subtotal + core_bonus_atk;
  const final_def  = def_subtotal + core_bonus_def;

  return {
    HP:  final_hp,
    ATK: final_atk,
    DEF: final_def
  };
}

const CUBE_STAT_TABLE = {
  1:  { HP: 11800, ATK: 390,  DEF: 78,  skill1_lv: 1, skill2_lv: 0 },
  2:  { HP: 13600, ATK: 450,  DEF: 90,  skill1_lv: 1, skill2_lv: 0 },
  3:  { HP: 15600, ATK: 520,  DEF: 103, skill1_lv: 2, skill2_lv: 0 },
  4:  { HP: 17900, ATK: 600,  DEF: 119, skill1_lv: 2, skill2_lv: 0 },
  5:  { HP: 20600, ATK: 690,  DEF: 136, skill1_lv: 2, skill2_lv: 1 },
  6:  { HP: 23700, ATK: 790,  DEF: 157, skill1_lv: 2, skill2_lv: 1 },
  7:  { HP: 27300, ATK: 910,  DEF: 180, skill1_lv: 3, skill2_lv: 1 },
  8:  { HP: 31400, ATK: 1050, DEF: 207, skill1_lv: 3, skill2_lv: 1 },
  9:  { HP: 36100, ATK: 1200, DEF: 239, skill1_lv: 3, skill2_lv: 2 },
  10: { HP: 41500, ATK: 1380, DEF: 274, skill1_lv: 3, skill2_lv: 3 },
  11: { HP: 47700, ATK: 1590, DEF: 316, skill1_lv: 3, skill2_lv: 4 },
  12: { HP: 54900, ATK: 1830, DEF: 363, skill1_lv: 3, skill2_lv: 4 },
  13: { HP: 63100, ATK: 2100, DEF: 417, skill1_lv: 3, skill2_lv: 5 },
  14: { HP: 72500, ATK: 2420, DEF: 480, skill1_lv: 3, skill2_lv: 5 },
  15: { HP: 83400, ATK: 2780, DEF: 552, skill1_lv: 3, skill2_lv: 6 }
};

function calcCubeBonus(index, charClass) {
  const cube_level = Number(document.getElementById(`char-${index}-cube-level`)?.value || 0);

  if (cube_level === 0) {
    return {
      bonus: 0,
      HP: 0,
      ATK: 0,
      DEF: 0
    }
  }
  else {
    const cube_skill1_level = CUBE_STAT_TABLE[cube_level].skill1_lv;
    const cube_skill2_level = CUBE_STAT_TABLE[cube_level].skill2_lv;
    const cube_bonus = CP_COEF * 4 / 3 * (cube_skill1_level + cube_skill2_level) +
      CP_COEF * 4 / 3 * (
        Math.ceil(cube_skill1_level / (cube_skill1_level + 1)) +
        3 * Math.ceil(cube_skill2_level / (cube_skill2_level + 1))
      );

    return {
      bonus: cube_bonus,
      HP: CUBE_STAT_TABLE[cube_level].HP,
      ATK: CUBE_STAT_TABLE[cube_level].ATK,
      DEF: CUBE_STAT_TABLE[cube_level].DEF
    }
  }
}

const DOLL_STAT_TABLE = {
  "R": {
    0:  {"HP": 19400,  "ATK": 638,  "DEF": 128},
    1:  {"HP": 24750,  "ATK": 809,  "DEF": 164},
    2:  {"HP": 30050,  "ATK": 980,  "DEF": 201},
    3:  {"HP": 35400,  "ATK": 1150, "DEF": 237},
    4:  {"HP": 40700,  "ATK": 1321, "DEF": 274},
    5:  {"HP": 48700,  "ATK": 1577, "DEF": 328},
    6:  {"HP": 56700,  "ATK": 1833, "DEF": 383},
    7:  {"HP": 64700,  "ATK": 2089, "DEF": 438},
    8:  {"HP": 72700,  "ATK": 2346, "DEF": 492},
    9:  {"HP": 80650,  "ATK": 2602, "DEF": 547},
    10: {"HP": 91350,  "ATK": 2943, "DEF": 620},
    11: {"HP": 102000, "ATK": 3285, "DEF": 692},
    12: {"HP": 112650, "ATK": 3626, "DEF": 765},
    13: {"HP": 123300, "ATK": 3968, "DEF": 838},
    14: {"HP": 133950, "ATK": 4309, "DEF": 911},
    15: {"HP": 147250, "ATK": 4736, "DEF": 1002},
  },
  "SR": {
    0:  {"HP": 94000,  "ATK": 3029, "DEF": 638},
    1:  {"HP": 104650, "ATK": 3370, "DEF": 711},
    2:  {"HP": 115300, "ATK": 3712, "DEF": 783},
    3:  {"HP": 125950, "ATK": 4053, "DEF": 856},
    4:  {"HP": 136600, "ATK": 4395, "DEF": 929},
    5:  {"HP": 149950, "ATK": 4821, "DEF": 1020},
    6:  {"HP": 163250, "ATK": 5248, "DEF": 1111},
    7:  {"HP": 176600, "ATK": 5675, "DEF": 1202},
    8:  {"HP": 189900, "ATK": 6102, "DEF": 1293},
    9:  {"HP": 203200, "ATK": 6529, "DEF": 1384},
    10: {"HP": 219200, "ATK": 7041, "DEF": 1494},
    11: {"HP": 235200, "ATK": 7554, "DEF": 1603},
    12: {"HP": 251150, "ATK": 8066, "DEF": 1712},
    13: {"HP": 267150, "ATK": 8578, "DEF": 1821},
    14: {"HP": 283150, "ATK": 9090, "DEF": 1931},
    15: {"HP": 301800, "ATK": 9688, "DEF": 2058},
  },
}

function calcDollBonus(index, charClass) {
  const collection_type = document.getElementById(`char-${index}-collection-type`)?.value;
  const collection_phase = document.getElementById(`char-${index}-collection-phase`)?.value;

  if (collection_type === 'R' || collection_type === 'SR') {
    const HP  = DOLL_STAT_TABLE[collection_type][collection_phase].HP;
    const ATK = DOLL_STAT_TABLE[collection_type][collection_phase].ATK;
    const DEF = DOLL_STAT_TABLE[collection_type][collection_phase].DEF;
    const skill1_lv = Math.floor(collection_phase / 5) + 1;
    const skill2_lv = 0;
    const doll_bonus = CP_COEF * (skill1_lv + skill2_lv) +
      CP_COEF * (19 * Math.ceil(skill1_lv / (skill1_lv + 1)) + 13 * Math.ceil(skill2_lv / (skill2_lv + 1))) / 3;

    return {
      bonus: doll_bonus,
      HP: HP,
      ATK: ATK,
      DEF: DEF,
    }
  }
  else if (collection_type === 'SR') {
    const HP  = DOLL_STAT_TABLE[collection_type][collection_phase].HP;
    const ATK = DOLL_STAT_TABLE[collection_type][collection_phase].ATK;
    const DEF = DOLL_STAT_TABLE[collection_type][collection_phase].DEF;
    const skill1_lv = Math.floor(collection_phase / 5) + 1;
    const skill2_lv = Math.floor(collection_phase / 5) + 1;
    const doll_bonus = CP_COEF * (skill1_lv + skill2_lv) +
      CP_COEF * (19 * Math.ceil(skill1_lv / (skill1_lv + 1)) + 13 * Math.ceil(skill2_lv / (skill2_lv + 1))) / 3;

    return {
      bonus: doll_bonus,
      HP: HP,
      ATK: ATK,
      DEF: DEF,
    }
  }
  else if (collection_type === 'SSR') {
    const HP  = DOLL_STAT_TABLE['SR'][15].HP;
    const ATK = DOLL_STAT_TABLE['SR'][15].ATK;
    const DEF = DOLL_STAT_TABLE['SR'][15].DEF;
    const skill1_lv = 4;
    const skill2_lv = 4;
    const doll_bonus = CP_COEF * (skill1_lv + skill2_lv) +
      CP_COEF * (19 * Math.ceil(skill1_lv / (skill1_lv + 1)) + 13 * Math.ceil(skill2_lv / (skill2_lv + 1))) / 3;
    return {
      bonus: doll_bonus,
      HP: HP,
      ATK: ATK,
      DEF: DEF,
    }
  }
  else {
    return {
      bonus: 0,
      HP: 0,
      ATK: 0,
      DEF: 0
    }
  }
}

function calcPower(index, charClass) {
  const level = 40;
  const duplicate = Number(document.getElementById(`char-${index}-duplicate`)?.value || 0);
  const skill1 = Number(document.getElementById(`char-${index}-skill1`)?.value || 0);
  const skill2 = Number(document.getElementById(`char-${index}-skill2`)?.value || 0);
  const burst = Number(document.getElementById(`char-${index}-skill-burst`)?.value || 0);
  const bond = Number(document.getElementById(`char-${index}-bond`)?.value || 0);
  const base_stats = calcBaseStats(index, charClass);
  const base_HP  = base_stats.HP;
  const base_ATK = base_stats.ATK;
  const base_DEF = base_stats.DEF;

  const skill_bonus = 1.3+0.01*(skill1+skill2+2*burst);

  let equipHP = 0;
  let equipATK = 0;
  let equipDEF = 0;

  let olBonus = 0;
  for (const part of EQUIP_PARTS) {
    const tier = document.getElementById(`char-${index}-equip-${part.key}-tier`)?.value;
    if (tier && tier !== '0' && equipData[tier]) {
      const stats = equipData[tier][part.key][charClass] || {};
      const equipLvNum = Number(document.getElementById(`char-${index}-equip-${part.key}-level`)?.value || 0);
      const scale = 1 + equipLvNum / 10;
      equipHP  += roundHalfToOdd((stats.HP  || 0) * scale);
      equipATK += roundHalfToOdd((stats.ATK || 0) * scale);
      equipDEF += roundHalfToOdd((stats.DEF || 0) * scale);
    }
    
    if (tier === '10') {
      for (let slot = 0; slot < 3; slot++) {
        const type = document.getElementById(`char-${index}-ol-${part.key}-${slot}-type`)?.value;
        const jpType = OVERLOAD_KEY_MAP[type];
        const olLevel = Number(document.getElementById(`char-${index}-ol-${part.key}-${slot}-level`)?.value || 0);

        if (jpType && olLevel && overloadData[jpType]) {
          const entry = overloadData[jpType].find(e => e.level === olLevel);
          if (entry) {
            olBonus += Number(entry.skill_multiplier) / 100.0;
          }
        }
      }
    }
  }
  // roundHalfToOdd は各部位ごとに適用済み（整数の合算なので追加の丸めは不要）

  const cube_bonus = calcCubeBonus(index, charClass);
  const doll_bonus = calcDollBonus(index, charClass);

  const crit_rate = 0.15;
  const crit_damage = 1.5;
  const hp  = base_HP  + equipHP  + cube_bonus.HP  + doll_bonus.HP;
  const atk = base_ATK + equipATK + cube_bonus.ATK + doll_bonus.ATK;
  const def = base_DEF + equipDEF + cube_bonus.DEF + doll_bonus.DEF;
  const base_cp = (18*atk*(crit_rate*(crit_damage-1)+1)+0.7*(def*100+hp))/100;

  const bonus_cp = skill_bonus + olBonus + cube_bonus.bonus + doll_bonus.bonus;
  return Math.round(base_cp * (bonus_cp));
}

const charList = document.getElementById('char-list');
const addBtn = document.getElementById('add-char-btn');
const dialog = document.getElementById('add-char-dialog');

addBtn.addEventListener('click', () => {
  document.getElementById('dialog-name').value = '';
  dialog.showModal();
});

dialog.addEventListener('close', () => {
  if (dialog.returnValue !== 'ok') return;
  const name = document.getElementById('dialog-name').value.trim();
  if (!name) return;
  const info = {
    name,
    rarity: document.getElementById('dialog-rarity').value,
    corp: document.getElementById('dialog-corp').value,
    class: document.getElementById('dialog-class').value,
    weapon: document.getElementById('dialog-weapon').value,
  };
  const card = createCharCard(charIndex, info);
  charList.appendChild(card);
  card.updatePower();
  charIndex++;
});

const generalResearch = document.getElementById('general-research');
const classResearchAttacker = document.getElementById('class-research-attacker');
const classResearchDefender = document.getElementById('class-research-defender');
const classResearchSupporter = document.getElementById('class-research-supporter');
const corpResearchElysion = document.getElementById('corp-research-elysion');
const corpResearchMissilis = document.getElementById('corp-research-missilis');
const corpResearchTetra = document.getElementById('corp-research-tetra');
const corpResearchPilgrim = document.getElementById('corp-research-pilgrim');
const corpResearchAbnormal = document.getElementById('corp-research-abnormal');

const researches = [
  generalResearch,
  classResearchAttacker,
  classResearchDefender,
  classResearchSupporter,
  corpResearchElysion,
  corpResearchMissilis,
  corpResearchTetra,
  corpResearchPilgrim,
  corpResearchAbnormal
];

for (const research of researches) {
  research.addEventListener('input', () => {
    const cards = charList.querySelectorAll('.char-card');
    for (const card of cards) {
      card.updatePower();
    }
  });
}


function saveToLocalStorage() {
  // 1. サイドバー（研究レベル）の保存
  const research = {
    general: document.getElementById('general-research').value,
    attacker: document.getElementById('class-research-attacker').value,
    defender: document.getElementById('class-research-defender').value,
    supporter: document.getElementById('class-research-supporter').value,
    elysion: document.getElementById('corp-research-elysion').value,
    missilis: document.getElementById('corp-research-missilis').value,
    tetra: document.getElementById('corp-research-tetra').value,
    pilgrim: document.getElementById('corp-research-pilgrim').value,
    abnormal: document.getElementById('corp-research-abnormal').value
  };

  // 2. キャラクターデータの保存
  const characters = [];
  document.querySelectorAll('.char-card').forEach(card => {
    const index = card.id.split('-')[1]; // char-0 なら '0' を取得

    const info = {
      name: document.getElementById(`char-${index}-name`).value,
      rarity: document.getElementById(`char-${index}-rarity`).value,
      corp: document.getElementById(`char-${index}-manufacturer`).value, // ※元のid名に合わせてます
      class: document.getElementById(`char-${index}-class`).value,
      weapon: document.getElementById(`char-${index}-weapon`).value,
    };

    const stats = {
      duplicate: document.getElementById(`char-${index}-duplicate`)?.value || "0",
      skill1: document.getElementById(`char-${index}-skill1`).value,
      skill2: document.getElementById(`char-${index}-skill2`).value,
      burst: document.getElementById(`char-${index}-skill-burst`).value,
      bond: document.getElementById(`char-${index}-bond`).value,
      collectionType: document.getElementById(`char-${index}-collection-type`)?.value || "none",
      collectionPhase: document.getElementById(`char-${index}-collection-phase`)?.value || "0",
      cubeLevel: document.getElementById(`char-${index}-cube-level`)?.value || "0",
    };

    const actualStats = {
      power: document.getElementById(`char-${index}-actual-power`)?.value || "",
      hp: document.getElementById(`char-${index}-actual-hp`)?.value || "",
      atk: document.getElementById(`char-${index}-actual-atk`)?.value || "",
      def: document.getElementById(`char-${index}-actual-def`)?.value || "",
    };

    // 装備の保存 (EQUIP_PARTS をループして取得)
    const equips = {};
    for (const part of EQUIP_PARTS) {
      equips[part.key] = {
        tier: document.getElementById(`char-${index}-equip-${part.key}-tier`).value,
        level: document.getElementById(`char-${index}-equip-${part.key}-level`).value,
        overloads: [0, 1, 2].map(slot => ({
          type: document.getElementById(`char-${index}-ol-${part.key}-${slot}-type`)?.value || "",
          level: document.getElementById(`char-${index}-ol-${part.key}-${slot}-level`)?.value || "0"
        }))
      };
    }

    characters.push({ info, stats, actualStats, equips });
  });

  // まとめて JSON 文字列にして保存！
  localStorage.setItem('omaruchi-power-calc', JSON.stringify({ research, characters }));
}


function loadFromLocalStorage() {
  const json = localStorage.getItem('omaruchi-power-calc');
  if (!json) return; // セーブデータがなければ終了

  const data = JSON.parse(json);

  // 1. 研究レベルの復元
  if (data.research) {
    document.getElementById('general-research').value = data.research.general || 0;
    document.getElementById('class-research-attacker').value = data.research.attacker || 0;
    document.getElementById('class-research-defender').value = data.research.defender || 0;
    document.getElementById('class-research-supporter').value = data.research.supporter || 0;
    document.getElementById('corp-research-elysion').value = data.research.elysion || 0;
    document.getElementById('corp-research-missilis').value = data.research.missilis || 0;
    document.getElementById('corp-research-tetra').value = data.research.tetra || 0;
    document.getElementById('corp-research-pilgrim').value = data.research.pilgrim || 0;
    document.getElementById('corp-research-abnormal').value = data.research.abnormal || 0;
  }

  // 2. キャラクターの復元
  if (data.characters) {
    data.characters.forEach(char => {
      // 情報をもとにカードを作成し、画面に追加
      const card = createCharCard(charIndex, char.info);
      document.getElementById('char-list').appendChild(card);

      // 基本ステータスの復元
      document.getElementById(`char-${charIndex}-duplicate`).value = char.stats.duplicate;
      document.getElementById(`char-${charIndex}-duplicate-display`).textContent = duplicateDisplay(char.stats.duplicate);

      document.getElementById(`char-${charIndex}-skill1`).value = char.stats.skill1;
      document.getElementById(`char-${charIndex}-skill2`).value = char.stats.skill2;
      document.getElementById(`char-${charIndex}-skill-burst`).value = char.stats.burst;
      document.getElementById(`char-${charIndex}-bond`).value = char.stats.bond;

      if (document.getElementById(`char-${charIndex}-cube-level`)) {
        document.getElementById(`char-${charIndex}-cube-level`).value = char.stats.cubeLevel;
      }

      // コレクションの復元 (イベントを発火させて隣のプルダウンを生成する)
      const colType = document.getElementById(`char-${charIndex}-collection-type`);
      if (colType) {
        colType.value = char.stats.collectionType;
        colType.dispatchEvent(new Event('change')); // ★重要
        document.getElementById(`char-${charIndex}-collection-phase`).value = char.stats.collectionPhase;
      }

      // キューブの復元

      // 装備の復元
      for (const part of EQUIP_PARTS) {
        const eqData = char.equips[part.key];
        const tierSelect = document.getElementById(`char-${charIndex}-equip-${part.key}-tier`);

        tierSelect.value = eqData.tier;
        tierSelect.dispatchEvent(new Event('change')); // ★重要 (Lvのoptionやオーバーロード枠を出すため)

        document.getElementById(`char-${charIndex}-equip-${part.key}-level`).value = eqData.level;

        // オーバーロードの復元
        eqData.overloads.forEach((ol, slot) => {
          const typeSelect = document.getElementById(`char-${charIndex}-ol-${part.key}-${slot}-type`);
          if (typeSelect && ol.type) {
            typeSelect.value = ol.type;
            typeSelect.dispatchEvent(new Event('change')); // ★重要 (Lvのoptionを出すため)
            document.getElementById(`char-${charIndex}-ol-${part.key}-${slot}-level`).value = ol.level;
          }
        });
      }

      // 実際のステータスの復元
      if (char.actualStats) {
        const ap = document.getElementById(`char-${charIndex}-actual-power`);
        const ah = document.getElementById(`char-${charIndex}-actual-hp`);
        const aa = document.getElementById(`char-${charIndex}-actual-atk`);
        const ad = document.getElementById(`char-${charIndex}-actual-def`);
        if (ap) ap.value = char.actualStats.power || "";
        if (ah) ah.value = char.actualStats.hp || "";
        if (aa) aa.value = char.actualStats.atk || "";
        if (ad) ad.value = char.actualStats.def || "";
      }

      // 最後にこのキャラの戦闘力を再計算
      card.updatePower();
      charIndex++;
    });
  }
}

// ページ読み込み時に実行（main.js の一番下などで呼ぶ）
// fetch('overload.json') などの非同期読み込みがある場合は、
// その読み込みが終わった後に呼ぶように調整が必要です！
window.addEventListener('DOMContentLoaded', () => {
  // jsonのロードを待つ必要がある場合は、Promise.allなどで待ってから loadFromLocalStorage() を呼ぶと安全です
});

document.getElementById('export-btn').addEventListener('click', () => {                                                                                      
  // まず最新の状態をlocalStorageに保存                                                      
  saveToLocalStorage();                                                                                                                                      
                                                                                                                                                              
  // 保存されたデータを取り出す                                                                                                                              
  const json = localStorage.getItem('omaruchi-power-calc'); // ※ここのキー名も実際の環境に合わせてください                                                         
  if (!json) {                                                                                                                                               
    alert('エクスポートするデータがありません！');                                                                                                           
    return;                                                                                                                                                  
  }                                                                                                                                                          
                                                                                                                                                              
  // ファイルとしてダウンロードさせる処理                                                                                                                    
  const blob = new Blob([json], { type: 'application/json' });                                                                                               
  const url = URL.createObjectURL(blob);                                                                                                                     
  const a = document.createElement('a');                                                                                                                     
  a.href = url;                                                                                                                                              
  a.download = 'omaruchi_power_calc.json'; // 保存されるファイル名                                                                                               
  document.body.appendChild(a);                                                                                                                              
  a.click();                                                                                                                                                 
  document.body.removeChild(a);                                                                                                                              
  URL.revokeObjectURL(url);                                                                                                                                  
});                                                                                                                                                          
                                                                                                                                                              
// 📥 インポート機能                                                                                                                                         
const importBtn = document.getElementById('import-btn');                                                                                                     
const importFile = document.getElementById('import-file');                                                                                                   
                                                                                                                                                              
// ボタンを押したら隠しファイル入力をクリックしたことにする                                                                                                  
importBtn.addEventListener('click', () => {                                                                                                                  
  importFile.click();                                                                                                                                        
});                                                                                                                                                          
                                                                                                                                                              
// ファイルが選ばれた時の処理                                                                                                                                
importFile.addEventListener('change', (e) => {                                                                                                               
  const file = e.target.files[0];                                                                                                                            
  if (!file) return;                                                                                                                                         
                                                                                                                                                              
  const reader = new FileReader();                                                                                                                           
  reader.onload = (event) => {                                                                                                                               
    try {                                                                                                                                                    
      const jsonStr = event.target.result;                                                                                                                   
                                                                                                                                                              
      // JSONとして正しい形式かチェック                                                                                                                      
      JSON.parse(jsonStr);                                                                                                                                   
                                                                                                                                                              
      // localStorageを上書きする                                                                                                                            
      localStorage.setItem('omaruchi-power-calc', jsonStr); // ※キー名は環境に合わせてください                                                                     
                                                                                                                                                              
      // 今ある画面上の要素を消して作り直すより、リロードするのが一番確実でバグが起きません                                                                  
      alert('データをインポートしました！画面を再読み込みして反映します。');                                                                                 
      location.reload();                                                                                                                                     
                                                                                                                                                              
    } catch (err) {                                                                                                                                          
      alert('エラー：正しいJSONファイルではありません！');                                                                                                   
    }                                                                                                                                                        
                                                                                                                                                              
    // 次回も同じファイルを選べるようにリセットしておく                                                                                                      
    importFile.value = '';                                                                                                                                   
  };
  
  // テキストとしてファイルを読み込む
  reader.readAsText(file);
});

const sidebarToggle = document.getElementById('sidebar-toggle');                                                                                             
const sidebar = document.getElementById('sidebar');                                                                                                          
const sidebarOverlay = document.getElementById('sidebar-overlay');                                                                                           
                                                                                                                                                              
function toggleSidebar() {                                                                                                                                   
  // open / show というクラスをつけたり消したりする                                                                                                          
  sidebar.classList.toggle('open');                                                                                                                          
  sidebarOverlay.classList.toggle('show');                                                                                                                   
}

if (sidebarToggle && sidebarOverlay) {
  // ボタンを押した時
  sidebarToggle.addEventListener('click', toggleSidebar);
  // 暗い背景部分をタップした時も閉じるようにする
  sidebarOverlay.addEventListener('click', toggleSidebar);
}