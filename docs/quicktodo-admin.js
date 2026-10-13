(() => {
  const ADMIN = 'QuickAdmin'
  const API = 'https://htjshlxupcjcchvadzdi.supabase.co/rest/v1'
  const KEY = 'sb_publishable_4-wHVa2ja45LMQixJK6xsA_G86nZbU8'
  let root = null
  let people = []
  let threads = []
  let query = ''
  let showHidden = false
  let expanded = null

  const h = () => ({
    apikey: KEY,
    Authorization: 'Bearer ' + KEY,
    'Content-Type': 'application/json',
    'x-quicktodo-admin': ADMIN,
  })
  const norm = (v) => String(v || '').trim().toLocaleLowerCase('ko-KR')
  const esc = (v) => String(v || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  const fmt = (v) => v ? new Intl.DateTimeFormat('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(v)) : '-'

  async function err(res) {
    const t = await res.text()
    try { const j = JSON.parse(t); return j.message || j.error_description || t } catch { return t || ('HTTP ' + res.status) }
  }

  async function rpc(name, body) {
    const res = await fetch(API + '/rpc/' + name, { method:'POST', headers:h(), body:JSON.stringify(body) })
    if (!res.ok) throw new Error(await err(res))
    const t = await res.text()
    return t ? JSON.parse(t) : null
  }

  async function getThreads() {
    const fields = 'id,author_person_id,assignee_person_id,title,project_label,kind,status,result_report,created_at,closed_at'
    const res = await fetch(API + '/todo_threads?select=' + fields + '&order=created_at.desc', { headers:h() })
    if (!res.ok) throw new Error(await err(res))
    return res.json()
  }

  function friendly(e) {
    const m = String((e && e.message) || e || '')
    if (m.includes('active_threads_exist')) return '진행 중인 업무가 있는 사용자는 숨길 수 없습니다.'
    if (m.includes('merge_direct_thread_conflict')) return '두 사용자 사이에 직접 연결된 업무가 있어 자동 병합할 수 없습니다.'
    if (m.includes('person_has_history')) return '업무 이력이 있는 사용자는 완전삭제할 수 없습니다.'
    if (m.includes('duplicate key')) return '이미 같은 이름의 사용자가 있습니다.'
    if (m.includes('reserved_admin_name')) return 'QuickAdmin은 관리자 예약 이름입니다.'
    return m || '처리 중 오류가 발생했습니다.'
  }

  function message(text, bad) {
    const el = root && root.querySelector('.qt-admin-message')
    if (!el) return
    el.textContent = text
    el.className = 'qt-admin-message ' + (bad ? 'error' : 'ok')
  }

  function details(personId) {
    const names = new Map(people.map((p) => [p.id, p.name]))
    const rows = threads.filter((t) => t.author_person_id === personId || t.assignee_person_id === personId)
    if (!rows.length) return '<div class="qt-admin-empty-small">업무 이력이 없습니다.</div>'
    return '<div class="qt-admin-thread-list">' + rows.map((t) => {
      const state = t.closed_at ? '완료' : (t.status === 'awaiting_confirmation' ? '확인필요' : '진행')
      return '<div class="qt-admin-thread"><div class="qt-admin-thread-top"><strong>' + esc(t.title) +
        '</strong><span class="qt-admin-state ' + (t.closed_at ? 'closed' : '') + '">' + state +
        '</span></div><div class="qt-admin-thread-meta"><span>' + esc(t.project_label || '사업 미지정') +
        '</span><span>' + esc(names.get(t.author_person_id) || '알 수 없음') + ' → ' +
        esc(names.get(t.assignee_person_id) || '알 수 없음') + '</span><span>' + fmt(t.created_at) +
        '</span></div></div>'
    }).join('') + '</div>'
  }

  function render() {
    const list = people.filter((p) => (showHidden || !p.is_hidden) && (!query || norm(p.name).includes(norm(query))))
    const visible = people.filter((p) => !p.is_hidden).length
    const hidden = people.filter((p) => p.is_hidden).length
    const active = people.reduce((n,p) => n + Number(p.active_threads || 0), 0)

    let cards = ''
    list.forEach((p) => {
      const a = Number(p.active_threads || 0)
      const c = Number(p.closed_threads || 0)
      const open = expanded === p.id
      cards += '<article class="qt-admin-user ' + (p.is_hidden ? 'hidden-user' : '') + '">' +
        '<div class="qt-admin-user-main"><div class="qt-admin-user-name"><strong>' + esc(p.name) + '</strong>' +
        (p.is_hidden ? '<span class="qt-admin-hidden-badge">숨김</span>' : '') +
        '</div><div class="qt-admin-user-meta"><span>진행 <b>' + a + '</b></span><span>완료 <b>' + c +
        '</b></span><span>최근 ' + fmt(p.last_seen_at) + '</span></div></div>' +
        '<div class="qt-admin-actions">' +
        '<button data-a="view" data-id="' + p.id + '">' + (open ? '닫기' : '업무 보기') + '</button>' +
        '<button data-a="rename" data-id="' + p.id + '">이름변경</button>' +
        '<button data-a="merge" data-id="' + p.id + '">병합</button>' +
        '<button data-a="hide" data-id="' + p.id + '" data-hidden="' + (p.is_hidden ? '1' : '0') + '"' +
        ((!p.is_hidden && a > 0) ? ' disabled title="진행업무가 있어 숨길 수 없습니다."' : '') + '>' +
        (p.is_hidden ? '복구' : '숨김') + '</button>' +
        ((a + c === 0) ? '<button class="danger" data-a="delete" data-id="' + p.id + '">완전삭제</button>' : '') +
        '</div>' + (open ? '<div class="qt-admin-details">' + details(p.id) + '</div>' : '') + '</article>'
    })

    root.innerHTML =
      '<main class="qt-admin-shell">' +
      '<header class="qt-admin-header"><div><strong>QuickTodo 관리자</strong><span>사용자 · 업무 연결 관리</span></div>' +
      '<button class="qt-admin-ghost" data-a="exit">사용자 화면</button></header>' +
      '<section class="qt-admin-summary"><div><span>사용자</span><strong>' + visible + '</strong></div>' +
      '<div><span>숨김</span><strong>' + hidden + '</strong></div><div><span>진행업무</span><strong>' + active + '</strong></div></section>' +
      '<section class="qt-admin-controls"><input class="qt-admin-search" value="' + esc(query) + '" placeholder="사용자 검색">' +
      '<label class="qt-admin-toggle"><input type="checkbox" ' + (showHidden ? 'checked' : '') + '><span>숨김 사용자 보기</span></label>' +
      '<button class="qt-admin-refresh" data-a="refresh">새로고침</button></section>' +
      '<div class="qt-admin-message"></div><section class="qt-admin-users">' +
      (cards || '<div class="qt-admin-empty">조건에 맞는 사용자가 없습니다.</div>') + '</section>' +
      '<footer class="qt-admin-footer">진행업무가 있는 사용자는 숨길 수 없습니다. 중복 사용자는 병합 후 원래 이름을 숨김 처리합니다.</footer></main>'

    const search = root.querySelector('.qt-admin-search')
    search.addEventListener('input', (e) => {
      query = e.target.value
      render()
      const next = root.querySelector('.qt-admin-search')
      next.focus()
      next.setSelectionRange(query.length, query.length)
    })
    root.querySelector('.qt-admin-toggle input').addEventListener('change', (e) => { showHidden = e.target.checked; render() })
    root.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => act(b)))
  }

  async function load() {
    root.classList.add('qt-admin-busy')
    try {
      const result = await Promise.all([rpc('quicktodo_admin_people',{p_admin_name:ADMIN}), getThreads()])
      people = result[0] || []
      threads = result[1] || []
      render()
    } catch(e) { message(friendly(e), true) }
    finally { root.classList.remove('qt-admin-busy') }
  }

  async function act(b) {
    const a = b.dataset.a
    if (a === 'exit') { location.reload(); return }
    if (a === 'refresh') { await load(); return }
    const p = people.find((x) => x.id === b.dataset.id)
    if (!p) return
    if (a === 'view') { expanded = expanded === p.id ? null : p.id; render(); return }

    try {
      if (a === 'rename') {
        const name = prompt('변경할 이름을 입력하세요.', p.name)
        if (!name || !name.trim() || name.trim() === p.name) return
        await rpc('quicktodo_admin_rename_person',{p_admin_name:ADMIN,p_person_id:p.id,p_name:name.trim()})
      } else if (a === 'merge') {
        const choices = people.filter((x) => x.id !== p.id && !x.is_hidden)
        const name = prompt(p.name + '의 업무/이력을 합칠 대상 이름을 입력하세요.\n\n가능: ' + choices.map((x) => x.name).join(', '),'')
        if (!name) return
        const target = choices.find((x) => norm(x.name) === norm(name))
        if (!target) { alert('일치하는 활성 사용자를 찾지 못했습니다.'); return }
        if (!confirm(p.name + '의 모든 업무 연결을 ' + target.name + '(으)로 옮기고 원래 이름을 숨길까요?')) return
        await rpc('quicktodo_admin_merge_person',{p_admin_name:ADMIN,p_source_person_id:p.id,p_target_person_id:target.id})
        expanded = null
      } else if (a === 'hide') {
        const hidden = b.dataset.hidden === '1'
        if (!hidden && Number(p.active_threads || 0) > 0) { alert('진행 중인 업무가 있어 숨길 수 없습니다.'); return }
        if (!confirm(p.name + '을(를) ' + (hidden ? '복구' : '목록에서 숨김') + ' 처리할까요?')) return
        await rpc('quicktodo_admin_set_hidden',{p_admin_name:ADMIN,p_person_id:p.id,p_hidden:!hidden})
      } else if (a === 'delete') {
        const typed = prompt('업무 이력이 없는 사용자만 완전삭제할 수 있습니다.\n삭제하려면 "' + p.name + '"을 다시 입력하세요.')
        if (typed !== p.name) return
        await rpc('quicktodo_admin_delete_empty_person',{p_admin_name:ADMIN,p_person_id:p.id})
        expanded = null
      }
      await load()
    } catch(e) { alert(friendly(e)) }
  }

  function enter() {
    if (document.getElementById('qt-admin-root')) return
    const app = document.getElementById('root')
    if (!app) return
    app.style.display = 'none'
    document.body.classList.add('qt-admin-open')
    root = document.createElement('div')
    root.id = 'qt-admin-root'
    document.body.appendChild(root)
    root.innerHTML = '<div class="qt-admin-loading">관리자 정보를 불러오는 중...</div>'
    load()
  }

  function intercept(e) {
    const login = document.querySelector('.mobile-login')
    if (!login) return
    const input = login.querySelector('input[placeholder="이름"]')
    if (!input || norm(input.value) !== norm(ADMIN)) return
    e.preventDefault()
    e.stopPropagation()
    if (e.stopImmediatePropagation) e.stopImmediatePropagation()
    enter()
  }

  document.addEventListener('click',(e) => {
    const b = e.target.closest && e.target.closest('button')
    if (b && b.textContent.trim() === '시작') intercept(e)
  },true)

  document.addEventListener('keydown',(e) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.placeholder === '이름') intercept(e)
  },true)
})()
