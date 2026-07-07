const state = {
    teacherToken: sessionStorage.getItem('teacherToken') || '',
    studentToken: sessionStorage.getItem('studentToken') || '',
    selectedClass: '',
    selectedAssignmentId: '',
    latestClassSummary: null,
    latestSgsExport: null,
    pendingStudentImport: [],
    scoreAutosaveTimers: {},
    scanCameraStream: null,
    scanResults: [],
    scanAutoTimer: null,
    scanBusy: false,
    studentTeacherRequestId: 0,
    studentClassRequestId: 0,
    studentRosterRequestId: 0,
    teacherMode: 'legacy',
    teacherView: 'score',
  };

  document.addEventListener('DOMContentLoaded', () => {
    bindNavigationLinks();
    if (window.APP_PAGE === 'teacher') {
      initTeacherPage();
    }
    if (window.APP_PAGE === 'student') {
      initStudentPage();
    }
  });

  function bindNavigationLinks() {
    document.querySelectorAll('[data-page]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        navigateToPage(link.dataset.page || 'index');
      });
    });
  }

  function navigateToPage(page) {
    if (window.APP_STATIC_FRONTEND) {
      window.location.href = getStaticPageUrl(page);
      return;
    }

    const baseUrl = getNavigationBaseUrl();
    const targetUrl = page && page !== 'index'
      ? baseUrl + '?page=' + encodeURIComponent(page)
      : baseUrl;
    window.top.location.href = targetUrl;
  }

  function getStaticPageUrl(page) {
    const filename = page && page !== 'index' ? page + '.html' : 'index.html';
    return new URL(filename, window.location.href).href;
  }

  function getNavigationBaseUrl() {
    if (window.APP_BASE_URL) {
      return window.APP_BASE_URL;
    }

    const candidates = [document.referrer, window.location.href].filter(Boolean);
    for (const url of candidates) {
      const match = String(url).match(/^https:\/\/script\.google\.com\/(?:a\/(?:\*|%2A)\/)?macros\/s\/[^/?#]+\/(?:exec|dev)/i);
      if (match) {
        return makePublicAppsScriptUrl(match[0]);
      }
    }

    return makePublicAppsScriptUrl(String(window.location.href).split('#')[0].split('?')[0]);
  }

  function makePublicAppsScriptUrl(url) {
    return String(url || '').replace(
      'https://script.google.com/macros/s/',
      'https://script.google.com/a/%2A/macros/s/'
    );
  }

  function initTeacherPage() {
    bindClick('teacher-login-button', handleTeacherLogin);
    bindClick('open-teacher-register', openTeacherRegister);
    bindClick('close-teacher-register', closeTeacherRegister);
    bindClick('teacher-register-button', handleTeacherRegister);
    bindClick('tenant-create-class', handleTenantCreateClass);
    bindClick('tenant-add-student', handleTenantAddStudent);
    bindClick('tenant-preview-import-students', handleTenantPreviewImportStudents);
    bindClick('tenant-import-students', handleTenantImportStudents);
    bindClick('refresh-class', () => {
      flushVisibleScoreAutosaves();
      loadSelectedClass();
    });
    bindClick('sync-students', handleSyncStudents);
    bindClick('download-csv', handleDownloadCsv);
    bindClick('teacher-score-view-button', () => setTeacherView('score'));
    bindClick('teacher-tools-view-button', () => setTeacherView('tools'));
    bindClick('build-sgs-summary', handleBuildSgsSummary);
    bindClick('copy-sgs-summary', handleCopySgsSummary);
    bindClick('download-sgs-csv', handleDownloadSgsCsv);
    bindClick('save-system-settings', handleSaveSystemSettings);
    bindClick('generate-student-pins', handleGenerateStudentPins);
    bindClick('download-pin-csv', handleDownloadPinCsv);
    bindClick('save-score-grid', handleSaveScoreGrid);
    bindClick('update-max-score', handleUpdateMaxScore);
    bindClick('add-assignment', handleAddAssignment);
    bindClick('scale-scores', handleScaleScores);
    bindClick('scan-capture-label', handleScanCaptureLabelClick);
    bindClick('open-scan-camera', handleOpenScanCamera);
    bindClick('scan-current-frame', handleScanCurrentFrame);
    bindClick('toggle-auto-scan', handleToggleAutoScan);
    bindClick('stop-scan-camera', handleStopScanCamera);
    bindClick('confirm-scan-results', handleConfirmScanResults);
    bindClick('load-student-report', loadTeacherStudentDetail);
    bindClick('make-score-report', () => makeTeacherReport('score'));
    bindClick('make-missing-report', () => makeTeacherReport('missing'));
    bindClick('print-summary', () => window.print());
    bindClick('copy-missing-summary', handleCopyMissingSummary);
    const missingDetailList = byId('missing-detail-list');
    if (missingDetailList) {
      missingDetailList.addEventListener('click', handleMissingDetailClick);
    }
    const select = byId('class-select');
    if (select) {
      select.addEventListener('change', () => {
        flushVisibleScoreAutosaves();
        state.selectedClass = select.value;
        state.selectedAssignmentId = '';
        clearScanResults('เปลี่ยนห้องแล้ว ล้างผลสแกนเดิมเพื่อกันบันทึกผิดห้อง');
        loadSelectedClass();
      });
    }
    const assignmentSelect = byId('assignment-select');
    if (assignmentSelect) {
      assignmentSelect.addEventListener('change', handleAssignmentChange);
    }
    const studentImportFile = byId('tenant-student-import-file');
    if (studentImportFile) {
      studentImportFile.addEventListener('change', handleTenantPreviewImportStudents);
    }
    const scanFallbackFile = byId('scan-image-fallback');
    if (scanFallbackFile) {
      scanFallbackFile.addEventListener('change', handleScanFallbackImageChange);
    }
    ['scale-start-assignment', 'scale-end-assignment', 'scale-target-max'].forEach((id) => {
      const element = byId(id);
      if (element) {
        element.addEventListener('change', updateScaleTargetTitle);
        element.addEventListener('input', updateScaleTargetTitle);
      }
    });
    const scaleTitle = byId('scale-target-title');
    if (scaleTitle) {
      scaleTitle.addEventListener('input', () => {
        scaleTitle.dataset.autoTitle = 'false';
      });
    }
    if (state.teacherToken) {
      loadTeacherDashboard();
    }
  }

  function openTeacherRegister() {
    const modal = byId('teacher-register');
    if (!modal) {
      return;
    }
    modal.classList.remove('hidden');
    setTeacherRegisterMessage('');
    const firstInput = byId('register-display-name');
    if (firstInput) {
      firstInput.focus();
    }
  }

  function closeTeacherRegister() {
    const modal = byId('teacher-register');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  function initStudentPage() {
    bindClick('student-login-button', handleStudentLogin);
    bindClick('load-student-login-options', loadStudentLoginClasses);
    bindClick('change-pin-button', handleChangeStudentPin);
    setupStudentLoginSelectors();
    if (state.studentToken) {
      serverCall('studentGetDashboard', [state.studentToken], renderStudentDashboard, showStudentError);
    }
  }

  function setupStudentLoginSelectors() {
    const teacherSelect = byId('student-teacher-username');
    const classSelect = byId('student-class');
    if (teacherSelect) {
      teacherSelect.addEventListener('change', () => {
        state.studentRosterRequestId += 1;
        loadStudentLoginClasses();
      });
    }
    if (classSelect) {
      classSelect.addEventListener('change', loadStudentLoginStudents);
    }
    resetStudentSelect('student-teacher-username', 'กำลังโหลดครูผู้สอน...', true);
    resetStudentSelect('student-class', 'กำลังโหลดห้อง...', true);
    resetStudentSelect('student-no', 'เลือกห้องก่อน', true);
    loadStudentTeacherChoices();
  }

  function loadStudentTeacherChoices() {
    const requestId = ++state.studentTeacherRequestId;
    state.studentClassRequestId += 1;
    state.studentRosterRequestId += 1;
    resetStudentSelect('student-teacher-username', 'กำลังโหลดครูผู้สอน...', true);
    resetStudentSelect('student-class', 'เลือกครูก่อน', true);
    resetStudentSelect('student-no', 'เลือกห้องก่อน', true);
    setStudentMessage('กำลังโหลดรายชื่อครู...');
    serverCall('studentGetTeacherChoices', [], (result) => {
      if (requestId !== state.studentTeacherRequestId) {
        return;
      }
      if (!result.success) {
        resetStudentSelect('student-teacher-username', 'ไม่พบครูผู้สอน', true);
        setStudentMessage(result.message || 'ไม่พบครูผู้สอน');
        return;
      }

      renderStudentTeacherOptions(result.teachers || []);
      if ((result.teachers || []).length > 0) {
        resetStudentSelect('student-class', 'เลือกครูก่อน', true);
        resetStudentSelect('student-no', 'เลือกห้องก่อน', true);
        setStudentMessage('เลือกครูผู้สอนก่อน แล้วเลือกห้องเรียน');
      } else {
        resetStudentSelect('student-class', 'ไม่มีห้องเรียน', true);
        setStudentMessage('ยังไม่มีครูผู้สอนให้เลือก');
      }
    }, (error) => {
      if (requestId !== state.studentTeacherRequestId) {
        return;
      }
      resetStudentSelect('student-teacher-username', 'โหลดครูไม่สำเร็จ', true);
      resetStudentSelect('student-class', 'เลือกครูก่อน', true);
      resetStudentSelect('student-no', 'เลือกห้องก่อน', true);
      showStudentError(error);
    });
  }

  function loadStudentLoginClasses() {
    const classSelect = byId('student-class');
    if (!classSelect) {
      return;
    }

    const teacherUsername = getStudentLoginTeacherUsername();
    const requestId = ++state.studentClassRequestId;
    state.studentRosterRequestId += 1;
    if (!teacherUsername) {
      resetStudentSelect('student-class', 'เลือกครูก่อน', true);
      resetStudentSelect('student-no', 'เลือกห้องก่อน', true);
      setStudentMessage('เลือกครูผู้สอนก่อน');
      return;
    }

    resetStudentSelect('student-class', 'กำลังโหลดห้อง...', true);
    resetStudentSelect('student-no', 'เลือกห้องก่อน', true);
    setStudentMessage('กำลังโหลดห้องเรียน...');
    serverCall('studentGetLoginOptions', [teacherUsername], (result) => {
      if (requestId !== state.studentClassRequestId || teacherUsername !== getStudentLoginTeacherUsername()) {
        return;
      }
      if (!result.success) {
        resetStudentSelect('student-class', 'ไม่พบห้องเรียน', true);
        resetStudentSelect('student-no', 'เลือกห้องก่อน', true);
        setStudentMessage(result.message || 'ไม่พบห้องเรียน');
        return;
      }

      renderStudentClassOptions(result.classes || []);
      if ((result.classes || []).length > 0) {
        resetStudentSelect('student-no', 'เลือกห้องก่อน', true);
        setStudentMessage('เลือกห้องเรียน แล้วเลือกเลขที่ของนักเรียน');
      } else {
        resetStudentSelect('student-no', 'เลือกห้องก่อน', true);
        setStudentMessage('ยังไม่มีห้องเรียนให้เลือก');
      }
    }, (error) => {
      if (requestId !== state.studentClassRequestId || teacherUsername !== getStudentLoginTeacherUsername()) {
        return;
      }
      resetStudentSelect('student-class', 'โหลดห้องไม่สำเร็จ', true);
      resetStudentSelect('student-no', 'เลือกห้องก่อน', true);
      showStudentError(error);
    });
  }

  function loadStudentLoginStudents() {
    const teacherUsername = getStudentLoginTeacherUsername();
    const className = byId('student-class') ? byId('student-class').value : '';
    const requestId = ++state.studentRosterRequestId;
    if (!teacherUsername) {
      resetStudentSelect('student-no', 'เลือกครูก่อน', true);
      setStudentMessage('เลือกครูผู้สอนก่อน');
      return;
    }
    if (!className) {
      resetStudentSelect('student-no', 'เลือกห้องก่อน', true);
      setStudentMessage('เลือกห้องเรียนก่อน');
      return;
    }

    resetStudentSelect('student-no', 'กำลังโหลดรายชื่อ...', true);
    setStudentMessage('กำลังโหลดรายชื่อนักเรียน...');
    serverCall('studentGetLoginStudents', [teacherUsername, className], (result) => {
      if (
        requestId !== state.studentRosterRequestId ||
        teacherUsername !== getStudentLoginTeacherUsername() ||
        className !== (byId('student-class') ? byId('student-class').value : '')
      ) {
        return;
      }
      if (!result.success) {
        resetStudentSelect('student-no', 'ไม่พบรายชื่อ', true);
        setStudentMessage(result.message || 'ไม่พบรายชื่อนักเรียน');
        return;
      }

      renderStudentNoOptions(result.students || []);
      setStudentMessage((result.students || []).length > 0 ? '' : 'ยังไม่มีรายชื่อนักเรียนในห้องนี้');
    }, (error) => {
      if (
        requestId !== state.studentRosterRequestId ||
        teacherUsername !== getStudentLoginTeacherUsername() ||
        className !== (byId('student-class') ? byId('student-class').value : '')
      ) {
        return;
      }
      resetStudentSelect('student-no', 'โหลดรายชื่อไม่สำเร็จ', true);
      showStudentError(error);
    });
  }

  function renderStudentClassOptions(classes) {
    const select = byId('student-class');
    if (!select) {
      return;
    }

    select.innerHTML = '';
    if (!classes || classes.length === 0) {
      addOption(select, '', 'ไม่พบห้องเรียน');
      select.disabled = true;
      return;
    }

    addOption(select, '', 'เลือกห้องเรียน');
    classes.forEach((item) => {
      addOption(select, item.className, item.label || item.className);
    });
    select.value = '';
    select.disabled = false;
  }

  function renderStudentTeacherOptions(teachers) {
    const select = byId('student-teacher-username');
    if (!select) {
      return;
    }

    select.innerHTML = '';
    if (!teachers || teachers.length === 0) {
      addOption(select, '', 'ไม่พบครูผู้สอน');
      select.disabled = true;
      return;
    }

    addOption(select, '', 'เลือกครูผู้สอน');
    teachers.forEach((teacher) => {
      addOption(select, teacher.username, teacher.label || teacher.displayName || teacher.username);
    });
    select.value = '';
    select.disabled = false;
  }

  function renderStudentNoOptions(students) {
    const select = byId('student-no');
    if (!select) {
      return;
    }

    select.innerHTML = '';
    if (!students || students.length === 0) {
      addOption(select, '', 'ไม่พบรายชื่อนักเรียน');
      select.disabled = true;
      return;
    }

    addOption(select, '', 'เลือกเลขที่ / ชื่อนักเรียน');
    students.forEach((student) => {
      addOption(select, student.no, student.label || (student.no + ' — ' + student.name));
    });
    select.value = '';
    select.disabled = false;
  }

  function resetStudentSelect(id, label, disabled) {
    const select = byId(id);
    if (!select) {
      return;
    }
    select.innerHTML = '';
    addOption(select, '', label);
    select.disabled = !!disabled;
  }

  function addOption(select, value, label) {
    const option = document.createElement('option');
    option.value = value || '';
    option.textContent = label || '';
    select.appendChild(option);
  }

  function getStudentLoginTeacherUsername() {
    const input = byId('student-teacher-username');
    return input ? input.value.trim() : '';
  }

  function handleTeacherLogin() {
    setTeacherMessage('กำลังเข้าสู่ระบบ...');
    setBusy('teacher-login-button', true);
    serverCall('teacherLogin', [byId('teacher-password').value, byId('teacher-username').value], (result) => {
      setBusy('teacher-login-button', false);
      if (!result.success) {
        setTeacherMessage(result.message || 'เข้าสู่ระบบไม่สำเร็จ');
        return;
      }
      state.teacherToken = result.token;
      sessionStorage.setItem('teacherToken', result.token);
      renderTeacherDashboard(result.dashboard);
      if (result.mustChangePassword) {
        showTeacherWarning('กรุณาเปลี่ยนรหัสครูในแผงตั้งค่าระบบก่อนใช้งานจริง');
      }
    }, (error) => {
      setBusy('teacher-login-button', false);
      setTeacherMessage(error.message || String(error));
    });
  }

  function handleTeacherRegister() {
    setTeacherRegisterMessage('กำลังสมัครครูใหม่...');
    setBusy('teacher-register-button', true);
    serverCall('teacherRegister', [
      byId('register-username').value,
      byId('register-password').value,
      byId('register-display-name').value,
    ], (result) => {
      setBusy('teacher-register-button', false);
      byId('register-password').value = '';
      byId('register-display-name').value = '';
      byId('register-username').value = '';
      setTeacherRegisterMessage(result.message || 'สมัครครูใหม่เรียบร้อยแล้ว');
    }, (error) => {
      setBusy('teacher-register-button', false);
      setTeacherRegisterMessage(error.message || String(error));
    });
  }

  function loadTeacherDashboard() {
    serverCall('teacherGetDashboard', [state.teacherToken], renderTeacherDashboard, showTeacherWarning);
  }

  function renderTeacherDashboard(dashboard) {
    state.teacherMode = dashboard.mode || 'legacy';
    byId('teacher-login').classList.toggle('hidden', true);
    closeTeacherRegister();
    setTeacherView(state.teacherView || 'score');
    byId('teacher-app').classList.toggle('hidden', false);
    const tenantTools = byId('tenant-tools');
    if (tenantTools) {
      tenantTools.classList.toggle('hidden', false);
    }
    const tenantClassPanel = byId('tenant-class-panel');
    if (tenantClassPanel) {
      tenantClassPanel.classList.toggle('hidden', state.teacherMode !== 'tenant');
    }
    const legacyTools = byId('legacy-tools');
    if (legacyTools) {
      legacyTools.classList.toggle('hidden', state.teacherMode === 'tenant');
    }
    const syncButton = byId('sync-students');
    if (syncButton) {
      syncButton.classList.toggle('hidden', state.teacherMode === 'tenant');
    }
    const select = byId('class-select');
    select.innerHTML = '';
    dashboard.classes.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.className;
      option.textContent = item.className;
      select.appendChild(option);
    });
    state.selectedClass = select.value;
    if (dashboard.settings && dashboard.settings.teacherPasswordDefault) {
      showTeacherWarning('กรุณาเปลี่ยนรหัสครูในแผงตั้งค่าระบบก่อนใช้งานจริง');
    }
    renderSystemSettings(dashboard.settings || {});
    if (state.selectedClass) {
      loadSelectedClass();
    } else {
      renderEmptyClassState();
      showTeacherWarning(state.teacherMode === 'tenant' ? 'เริ่มจากเพิ่มห้อง/กลุ่มเรียนก่อน แล้วค่อยเพิ่มนักเรียนและงาน' : '');
    }
  }

  function setTeacherView(view) {
    const nextView = view === 'tools' ? 'tools' : 'score';
    state.teacherView = nextView;
    const app = byId('teacher-app');
    if (app) {
      app.dataset.teacherView = nextView;
    }

    const scoreButton = byId('teacher-score-view-button');
    const toolsButton = byId('teacher-tools-view-button');
    if (scoreButton) {
      scoreButton.classList.toggle('button-outline', nextView !== 'score');
      scoreButton.setAttribute('aria-current', nextView === 'score' ? 'page' : 'false');
    }
    if (toolsButton) {
      toolsButton.classList.toggle('button-outline', nextView !== 'tools');
      toolsButton.setAttribute('aria-current', nextView === 'tools' ? 'page' : 'false');
    }
  }

  function renderEmptyClassState() {
    state.latestClassSummary = null;
    ['metric-students', 'metric-assignments', 'metric-max', 'metric-risk'].forEach((id) => {
      const element = byId(id);
      if (element) {
        element.textContent = '-';
      }
    });
    ['student-summary-body', 'score-entry-body'].forEach((id) => {
      const body = byId(id);
      if (body) {
        body.innerHTML = '<tr><td colspan="6">ยังไม่มีข้อมูล</td></tr>';
      }
    });
    ['missing-list', 'risk-list', 'missing-detail-list'].forEach((id) => {
      const container = byId(id);
      if (container) {
        container.innerHTML = '<div class="list-item">ยังไม่มีข้อมูล</div>';
      }
    });
  }

  function renderSystemSettings(settings) {
    const appNameInput = byId('system-app-name');
    if (appNameInput) {
      appNameInput.value = settings.appName || '';
    }

    const teacherDisplayNameInput = byId('system-teacher-display-name');
    if (teacherDisplayNameInput) {
      teacherDisplayNameInput.value = settings.teacherDisplayName || '';
    }

    const teacherUsernameInput = byId('system-teacher-username');
    if (teacherUsernameInput) {
      teacherUsernameInput.value = settings.teacherUsername || '';
    }

    const missingPinCount = byId('missing-pin-count');
    if (missingPinCount) {
      missingPinCount.textContent = settings.missingPins === undefined ? '-' : settings.missingPins;
    }

    const aiScanReady = byId('ai-scan-ready');
    if (aiScanReady) {
      aiScanReady.textContent = settings.aiScanReady ? 'พร้อมใช้' : 'ยังไม่ได้ตั้งค่า';
    }
  }

  function loadSelectedClass() {
    const className = byId('class-select').value;
    if (!className) {
      renderEmptyClassState();
      showTeacherWarning(state.teacherMode === 'tenant' ? 'ยังไม่มีห้อง/กลุ่มเรียน' : '');
      return;
    }
    state.selectedClass = className;
    setBusy('refresh-class', true);
    serverCall('teacherGetClassSummary', [state.teacherToken, className], (result) => {
      setBusy('refresh-class', false);
      state.latestClassSummary = result;
      renderClassSummary(result);
    }, (error) => {
      setBusy('refresh-class', false);
      showTeacherWarning(error.message || String(error));
    });
  }

  function handleTenantCreateClass() {
    const payload = {
      className: byId('tenant-class-name').value.trim(),
      subject: byId('tenant-subject').value.trim(),
    };
    setBusy('tenant-create-class', true);
    showTeacherWarning('กำลังเพิ่มห้อง...');
    serverCall('teacherCreateClass', [state.teacherToken, payload], (result) => {
      setBusy('tenant-create-class', false);
      byId('tenant-class-name').value = '';
      byId('tenant-subject').value = '';
      showTeacherWarning(result.message || 'เพิ่มห้องแล้ว');
      loadTeacherDashboard();
    }, (error) => {
      setBusy('tenant-create-class', false);
      showTeacherWarning(error.message || String(error));
    });
  }

  function handleTenantAddStudent() {
    const className = byId('class-select').value;
    if (!className) {
      showTeacherWarning('กรุณาเพิ่มหรือเลือกห้องก่อน');
      return;
    }
    const payload = {
      className: className,
      no: byId('tenant-student-no').value.trim(),
      name: byId('tenant-student-name').value.trim(),
      pin: byId('tenant-student-pin').value.trim(),
    };
    setBusy('tenant-add-student', true);
    showTeacherWarning('กำลังเพิ่มนักเรียน...');
    serverCall('teacherAddTenantStudent', [state.teacherToken, payload], (result) => {
      setBusy('tenant-add-student', false);
      byId('tenant-student-no').value = '';
      byId('tenant-student-name').value = '';
      byId('tenant-student-pin').value = '';
      showTeacherWarning(result.message || 'เพิ่มนักเรียนแล้ว');
      if (result.settings) {
        renderSystemSettings(result.settings);
      }
      loadSelectedClass();
    }, (error) => {
      setBusy('tenant-add-student', false);
      showTeacherWarning(error.message || String(error));
    });
  }

  async function handleTenantPreviewImportStudents() {
    setBusy('tenant-preview-import-students', true);
    try {
      const students = await collectTenantStudentImportRows();
      state.pendingStudentImport = students;
      renderStudentImportPreview(students);
      showTeacherWarning(students.length > 0 ? 'ตรวจพบรายชื่อ ' + students.length + ' คน' : 'ยังไม่พบรายชื่อสำหรับนำเข้า');
    } catch (error) {
      state.pendingStudentImport = [];
      renderStudentImportPreview([]);
      showTeacherWarning(error.message || String(error));
    } finally {
      setBusy('tenant-preview-import-students', false);
    }
  }

  async function handleTenantImportStudents() {
    if (!state.selectedClass) {
      showTeacherWarning('กรุณาเพิ่มหรือเลือกห้องก่อน');
      return;
    }

    let students = [];
    try {
      students = await collectTenantStudentImportRows();
    } catch (error) {
      showTeacherWarning(error.message || String(error));
      return;
    }

    if (students.length === 0) {
      showTeacherWarning('ยังไม่พบรายชื่อสำหรับนำเข้า');
      renderStudentImportPreview([]);
      return;
    }

    setBusy('tenant-import-students', true);
    showTeacherWarning('กำลังนำเข้ารายชื่อ...');
    serverCall('teacherImportTenantStudents', [state.teacherToken, {
      className: state.selectedClass,
      students: students,
    }], (result) => {
      setBusy('tenant-import-students', false);
      state.pendingStudentImport = [];
      renderStudentImportPreview([]);
      showTeacherWarning(result.message || 'นำเข้ารายชื่อแล้ว');
      if (result.settings) {
        renderSystemSettings(result.settings);
      }
      loadSelectedClass();
    }, (error) => {
      setBusy('tenant-import-students', false);
      showTeacherWarning(error.message || String(error));
    });
  }

  async function collectTenantStudentImportRows() {
    const pasteInput = byId('tenant-student-paste');
    const fileInput = byId('tenant-student-import-file');
    const rows = [];
    const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

    if (file) {
      rows.push.apply(rows, await readStudentImportFile(file));
    }

    if (pasteInput && pasteInput.value.trim()) {
      rows.push.apply(rows, parseStudentImportText(pasteInput.value));
    }

    return normalizeStudentImportRows(rows);
  }

  function readStudentImportFile(file) {
    const filename = String(file && file.name || '').toLowerCase();
    if (/\.xlsx?$/.test(filename)) {
      if (!window.XLSX) {
        return Promise.reject(new Error('ตัวอ่านไฟล์ Excel ยังโหลดไม่สำเร็จ'));
      }
      return readFileAsArrayBuffer(file).then((buffer) => {
        const workbook = window.XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = sheetName ? workbook.Sheets[sheetName] : null;
        return sheet ? window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) : [];
      });
    }

    return readFileAsText(file).then(parseStudentImportText);
  }

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
      reader.readAsArrayBuffer(file);
    });
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
      reader.readAsText(file, 'utf-8');
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('อ่านภาพไม่สำเร็จ'));
      reader.readAsDataURL(file);
    });
  }

  function parseStudentImportText(text) {
    const cleanText = String(text || '').replace(/^\ufeff/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!cleanText) {
      return [];
    }

    if (cleanText.indexOf('\t') !== -1) {
      return cleanText.split('\n').map((line) => line.split('\t'));
    }

    return parseCsvRows(cleanText);
  }

  function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        row.push(cell);
        cell = '';
        continue;
      }

      if (char === '\n' && !inQuotes) {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
        continue;
      }

      cell += char;
    }

    row.push(cell);
    rows.push(row);
    return rows;
  }

  function normalizeStudentImportRows(rows) {
    const cleanRows = (rows || [])
      .map((row) => (row || []).map(normalizeImportCell))
      .filter((row) => row.some((cell) => cell !== ''));

    if (cleanRows.length === 0) {
      return [];
    }

    const headerIndex = findStudentImportHeaderIndex(cleanRows);
    const header = headerIndex >= 0 ? cleanRows[headerIndex] : [];
    const columns = headerIndex >= 0 ? detectStudentImportColumns(header) : { no: 0, name: 1, lastName: -1, pin: 2 };
    const dataRows = headerIndex >= 0 ? cleanRows.slice(headerIndex + 1) : cleanRows;
    const students = [];
    const seen = {};

    dataRows.forEach((row) => {
      const no = normalizeStudentNoCell(row[columns.no]);
      let name = normalizeStudentNameCell(row[columns.name]);
      if (columns.lastName >= 0 && columns.lastName !== columns.name) {
        name = (name + ' ' + normalizeStudentNameCell(row[columns.lastName])).trim();
      }
      const pin = columns.pin >= 0 ? normalizeImportCell(row[columns.pin]) : '';

      if (!no || !name || isStudentImportHeaderLike(no, name)) {
        return;
      }

      const key = no.toLowerCase();
      if (seen[key]) {
        return;
      }

      seen[key] = true;
      students.push({ no: no, name: name, pin: pin });
    });

    return students;
  }

  function findStudentImportHeaderIndex(rows) {
    const limit = Math.min(rows.length, 8);
    for (let index = 0; index < limit; index += 1) {
      const columns = detectStudentImportColumns(rows[index]);
      if (columns.no >= 0 && columns.name >= 0) {
        return index;
      }
    }

    return -1;
  }

  function detectStudentImportColumns(row) {
    const labels = (row || []).map((cell) => normalizeImportLabel(cell));
    const no = labels.findIndex((label) =>
      label === 'no' || label === 'number' || label === 'studentno' || label.indexOf('เลขที่') !== -1 || label === 'เลข'
    );
    const name = labels.findIndex((label) =>
      label.indexOf('ชื่อ') !== -1 || label === 'name' || label === 'fullname' || label === 'studentname'
    );
    const lastName = labels.findIndex((label) =>
      label.indexOf('นามสกุล') !== -1 || label === 'lastname' || label === 'surname'
    );
    const pin = labels.findIndex((label) =>
      label === 'pin' || label.indexOf('รหัส') !== -1 || label === 'password'
    );

    return { no: no, name: name, lastName: lastName, pin: pin };
  }

  function normalizeImportCell(value) {
    return String(value === null || value === undefined ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function normalizeImportLabel(value) {
    return normalizeImportCell(value).toLowerCase().replace(/[\s._\-:/\\]+/g, '');
  }

  function normalizeStudentNoCell(value) {
    const text = normalizeImportCell(value);
    if (/^\d+\.0+$/.test(text)) {
      return String(parseInt(text, 10));
    }
    return text;
  }

  function normalizeStudentNameCell(value) {
    return normalizeImportCell(value);
  }

  function isStudentImportHeaderLike(no, name) {
    const noLabel = normalizeImportLabel(no);
    const nameLabel = normalizeImportLabel(name);
    return noLabel.indexOf('เลข') !== -1 || noLabel === 'no' || nameLabel.indexOf('ชื่อ') !== -1 || nameLabel === 'name';
  }

  function renderStudentImportPreview(students) {
    const container = byId('tenant-student-import-preview');
    if (!container) {
      return;
    }

    if (!students || students.length === 0) {
      container.innerHTML = '<div class="list-item">ยังไม่มีรายชื่อ</div>';
      return;
    }

    const rows = students.slice(0, 10).map((student) => [
      '<tr>',
      td(student.no),
      td(student.name),
      td(student.pin || '-'),
      '</tr>',
    ].join('')).join('');
    const extra = students.length > 10 ? '<div class="list-item">และอีก ' + (students.length - 10) + ' คน</div>' : '';
    container.innerHTML = [
      '<div class="list-item"><strong>พร้อมนำเข้า ' + students.length + ' คน</strong></div>',
      '<div class="table-wrap"><table><thead><tr><th>เลขที่</th><th>ชื่อ-สกุล</th><th>PIN</th></tr></thead><tbody>',
      rows,
      '</tbody></table></div>',
      extra,
    ].join('');
  }

  function handleSyncStudents() {
    setBusy('sync-students', true);
    showTeacherWarning('กำลังซิงก์รายชื่อนักเรียน...');
    serverCall('teacherSyncStudents', [state.teacherToken], (result) => {
      setBusy('sync-students', false);
      showTeacherWarning(result.message || ('ซิงก์รายชื่อแล้ว เพิ่ม ' + result.addedCount + ' คน'));
      loadSelectedClass();
    }, (error) => {
      setBusy('sync-students', false);
      showTeacherWarning(error.message || String(error));
    });
  }

  function handleSaveSystemSettings() {
    const payload = {
      appName: byId('system-app-name').value.trim(),
      teacherDisplayName: byId('system-teacher-display-name').value.trim(),
      teacherUsername: byId('system-teacher-username').value.trim(),
      teacherPassword: byId('new-teacher-password').value.trim(),
      visionApiKey: byId('system-vision-api-key') ? byId('system-vision-api-key').value.trim() : '',
    };

    setBusy('save-system-settings', true);
    showTeacherWarning('กำลังบันทึกการตั้งค่า...');
    serverCall('teacherSaveSystemSettings', [state.teacherToken, payload], (result) => {
      setBusy('save-system-settings', false);
      byId('new-teacher-password').value = '';
      if (byId('system-vision-api-key')) {
        byId('system-vision-api-key').value = '';
      }
      showTeacherWarning(result.message || 'บันทึกการตั้งค่าแล้ว');
      if (result.settings) {
        renderSystemSettings(result.settings);
      }
    }, (error) => {
      setBusy('save-system-settings', false);
      showTeacherWarning(error.message || String(error));
    });
  }

  function handleGenerateStudentPins() {
    setBusy('generate-student-pins', true);
    showTeacherWarning('กำลังสร้าง PIN นักเรียน...');
    serverCall('teacherGenerateStudentPins', [state.teacherToken], (result) => {
      setBusy('generate-student-pins', false);
      showTeacherWarning(result.message || 'สร้าง PIN แล้ว');
      if (result.settings) {
        renderSystemSettings(result.settings);
      }
    }, (error) => {
      setBusy('generate-student-pins', false);
      showTeacherWarning(error.message || String(error));
    });
  }

  function handleDownloadPinCsv() {
    setBusy('download-pin-csv', true);
    serverCall('teacherExportStudentPinsCsv', [state.teacherToken], (result) => {
      setBusy('download-pin-csv', false);
      downloadTextFile(result.filename || 'student_pins.csv', '\ufeff' + (result.csv || ''), 'text/csv;charset=utf-8');
    }, (error) => {
      setBusy('download-pin-csv', false);
      showTeacherWarning(error.message || String(error));
    });
  }

  function renderClassSummary(result) {
    const summary = result.summary;
    state.latestClassSummary = result;
    byId('metric-students').textContent = summary.studentCount;
    byId('metric-assignments').textContent = summary.assignmentCount;
    byId('metric-max').textContent = formatValue(summary.maxTotal);
    byId('metric-risk').textContent = result.atRisk.length;
    renderAssignmentControls(summary);
    state.latestSgsExport = null;
    const sgsOutput = byId('sgs-output');
    if (sgsOutput) {
      sgsOutput.value = '';
    }

    const body = byId('student-summary-body');
    body.innerHTML = '';
    summary.students.forEach((student) => {
      const row = document.createElement('tr');
      row.innerHTML = [
        td(student.no),
        td(renderTeacherStudentName(student), true),
        td(formatValue(student.totalScore)),
        td(formatPercent(student.percent)),
        td(student.estimatedGrade),
        td(student.missingCount),
      ].join('');
      row.addEventListener('click', () => {
        byId('student-no-input').value = student.no;
        loadTeacherStudentDetail();
      });
      body.appendChild(row);
    });

    renderList('missing-list', result.missing.students, (student) =>
      '<strong>เลขที่ ' + escapeHtml(student.no) + ' ' + renderTeacherStudentName(student) + '</strong><span>ค้าง ' +
      student.missingCount + ' งาน</span>'
    );
    renderList('risk-list', result.atRisk, (student) =>
      '<strong>เลขที่ ' + escapeHtml(student.no) + ' ' + renderTeacherStudentName(student) + '</strong><span>' +
      formatPercent(student.percent) + ' เกรด ' + escapeHtml(student.estimatedGrade) + '</span>'
    );
    renderMissingDetailList(summary.students || []);
  }

  function renderMissingDetailList(students) {
    const container = byId('missing-detail-list');
    if (!container) {
      return;
    }

    container.innerHTML = '';
    if (!students || students.length === 0) {
      container.innerHTML = '<div class="list-item">ยังไม่มีข้อมูลนักเรียนในห้องนี้</div>';
      return;
    }

    students.forEach((student) => {
      const card = document.createElement('article');
      card.className = 'missing-detail-card';
      card.dataset.studentNo = student.no;
      const missingAssignments = student.missingAssignments || [];
      const missingList = missingAssignments.length > 0
        ? '<ol>' + missingAssignments.map((assignment) =>
          '<li>' + escapeHtml(assignment.title) + '</li>'
        ).join('') + '</ol>'
        : '<p class="note-text">ไม่มีงานค้าง</p>';
      card.innerHTML = [
        '<div class="missing-detail-head">',
        '<div><strong>เลขที่ ' + escapeHtml(student.no) + ' ' + renderTeacherStudentName(student) + '</strong>',
        '<span>' + (missingAssignments.length > 0 ? 'ค้าง ' + missingAssignments.length + ' งาน' : 'ไม่มีงานค้าง') + '</span></div>',
        '</div>',
        '<div class="missing-detail-work">',
        missingList,
        '</div>',
        '<label for="student-note-' + escapeHtml(student.no) + '">หมายเหตุส่วนตัวถึงนักเรียน</label>',
        '<textarea id="student-note-' + escapeHtml(student.no) + '" class="student-note-input" rows="3" data-student-no="' + escapeHtml(student.no) + '" placeholder="เช่น ส่งงานชิ้นที่ 2 เพิ่มนะ ครูรอตรวจให้อยู่">' + escapeHtml(student.note || '') + '</textarea>',
        '<div class="button-row">',
        '<button type="button" class="button-outline save-student-note" data-student-no="' + escapeHtml(student.no) + '">บันทึกหมายเหตุ</button>',
        '<span class="note-save-status" data-student-no="' + escapeHtml(student.no) + '"></span>',
        '</div>',
      ].join('');
      container.appendChild(card);
    });
  }

  function renderTeacherStudentName(student) {
    const nickname = String(student && student.nickname || '').trim();
    return [
      '<span class="student-full-name">',
      escapeHtml(student && student.name || ''),
      '</span>',
      nickname ? '<span class="teacher-nickname-chip">ชื่อเล่น: ' + escapeHtml(nickname) + '</span>' : '',
    ].join('');
  }

  function handleMissingDetailClick(event) {
    const button = event.target.closest('.save-student-note');
    if (!button) {
      return;
    }

    const card = button.closest('.missing-detail-card');
    const studentNo = button.dataset.studentNo || (card ? card.dataset.studentNo : '');
    const noteInput = card ? card.querySelector('.student-note-input') : null;
    const note = noteInput ? noteInput.value : '';
    saveStudentNote(studentNo, note, button);
  }

  function saveStudentNote(studentNo, note, button) {
    if (!state.selectedClass || !studentNo) {
      showTeacherWarning('กรุณาเลือกห้องและนักเรียนก่อนบันทึกหมายเหตุ');
      return;
    }

    const status = findStudentNoteStatus(studentNo);
    if (status) {
      status.textContent = 'กำลังบันทึก...';
    }
    if (button) {
      button.disabled = true;
    }

    serverCall('teacherSaveStudentNote', [state.teacherToken, state.selectedClass, studentNo, note], (result) => {
      if (button) {
        button.disabled = false;
      }
      if (status) {
        status.textContent = result.message || 'บันทึกแล้ว';
      }
      renderClassSummary(result);
    }, (error) => {
      if (button) {
        button.disabled = false;
      }
      if (status) {
        status.textContent = 'บันทึกไม่สำเร็จ';
      }
      showTeacherWarning((error && error.message) || String(error));
    });
  }

  function findStudentNoteStatus(studentNo) {
    const statuses = document.querySelectorAll('.note-save-status');
    for (let i = 0; i < statuses.length; i += 1) {
      if (String(statuses[i].dataset.studentNo || '') === String(studentNo || '')) {
        return statuses[i];
      }
    }
    return null;
  }

  function handleCopyMissingSummary() {
    const result = state.latestClassSummary;
    const students = result && result.summary ? result.summary.students || [] : [];
    const text = buildMissingSummaryText(state.selectedClass, students);
    copyTextToClipboard(text, () => {
      showTeacherWarning('คัดลอกสรุปงานค้างของห้อง ' + state.selectedClass + ' แล้ว');
    });
  }

  function buildMissingSummaryText(className, students) {
    const missingStudents = (students || []).filter((student) => (student.missingAssignments || []).length > 0);
    const lines = ['สรุปงานค้าง ห้อง ' + (className || '-')];
    if (missingStudents.length === 0) {
      lines.push('ไม่มีนักเรียนค้างงานในห้องนี้');
      return lines.join('\n');
    }

    missingStudents.forEach((student) => {
      lines.push(
        'เลขที่ ' + student.no + ' ' + student.name + ': ' +
        (student.missingAssignments || []).map((assignment) => assignment.title).join(', ')
      );
      if (student.note) {
        lines.push('  หมายเหตุ: ' + student.note);
      }
    });
    return lines.join('\n');
  }

  function renderAssignmentControls(summary) {
    const select = byId('assignment-select');
    if (!select) {
      return;
    }

    const assignments = summary.assignments || [];
    select.innerHTML = '';
    assignments.forEach((assignment, index) => {
      const option = document.createElement('option');
      option.value = assignment.assignmentId;
      option.textContent = formatAssignmentLabel(assignment, index);
      select.appendChild(option);
    });
    renderScaleControls(assignments);

    if (assignments.length === 0) {
      state.selectedAssignmentId = '';
      syncAssignmentMaxInput();
      renderScoreEntryGrid();
      return;
    }

    const hasCurrent = assignments.some((assignment) => assignment.assignmentId === state.selectedAssignmentId);
    if (!hasCurrent) {
      state.selectedAssignmentId = assignments[0].assignmentId;
    }
    select.value = state.selectedAssignmentId;
    syncAssignmentMaxInput();
    renderScoreEntryGrid();
  }

  function renderScaleControls(assignments) {
    const startSelect = byId('scale-start-assignment');
    const endSelect = byId('scale-end-assignment');
    const targetSelect = byId('scale-target-assignment');
    if (!startSelect || !endSelect || !targetSelect) {
      return;
    }

    const previousStartValue = startSelect.value;
    const previousEndValue = endSelect.value;
    const sourceAssignments = assignments.filter((assignment) => !assignment.isBonus);
    [startSelect, endSelect].forEach((select) => {
      const previousValue = select.value;
      select.innerHTML = '';
      assignments.forEach((assignment, index) => {
        const option = document.createElement('option');
        option.value = assignment.assignmentId;
        option.textContent = formatAssignmentLabel(assignment, index);
        option.disabled = !!assignment.isBonus;
        select.appendChild(option);
      });
      if (assignments.some((assignment) => assignment.assignmentId === previousValue && !assignment.isBonus)) {
        select.value = previousValue;
      }
    });

    if (sourceAssignments.length > 0) {
      const startFallback = sourceAssignments[0].assignmentId;
      const endFallback = sourceAssignments[Math.min(2, sourceAssignments.length - 1)].assignmentId;
      startSelect.value = sourceAssignments.some((assignment) => assignment.assignmentId === previousStartValue)
        ? previousStartValue
        : startFallback;
      endSelect.value = sourceAssignments.some((assignment) => assignment.assignmentId === previousEndValue)
        ? previousEndValue
        : endFallback;
    }

    const previousTarget = targetSelect.value;
    targetSelect.innerHTML = '';
    const newOption = document.createElement('option');
    newOption.value = '';
    newOption.textContent = 'สร้างงานใหม่';
    targetSelect.appendChild(newOption);
    assignments.forEach((assignment, index) => {
      const option = document.createElement('option');
      option.value = assignment.assignmentId;
      option.textContent = formatAssignmentLabel(assignment, index);
      targetSelect.appendChild(option);
    });
    if (assignments.some((assignment) => assignment.assignmentId === previousTarget)) {
      targetSelect.value = previousTarget;
    }

    updateScaleTargetTitle(true);
  }

  function updateScaleTargetTitle(forceAuto) {
    const input = byId('scale-target-title');
    if (!input) {
      return;
    }

    const title = buildScaleTargetTitle();
    input.placeholder = title || 'เช่น รวมงาน 1-3 /10';
    if (forceAuto || input.dataset.autoTitle !== 'false' || !input.value.trim()) {
      input.value = title;
      input.dataset.autoTitle = 'true';
    }
  }

  function buildScaleTargetTitle() {
    const assignments = getCurrentAssignments();
    const startId = byId('scale-start-assignment') ? byId('scale-start-assignment').value : '';
    const endId = byId('scale-end-assignment') ? byId('scale-end-assignment').value : '';
    const startIndex = assignments.findIndex((assignment) => assignment.assignmentId === startId);
    const endIndex = assignments.findIndex((assignment) => assignment.assignmentId === endId);
    const targetMax = byId('scale-target-max') ? byId('scale-target-max').value.trim() || '10' : '10';

    if (startIndex === -1 || endIndex === -1) {
      return '';
    }

    const from = Math.min(startIndex, endIndex);
    const to = Math.max(startIndex, endIndex);
    const sourceAssignments = assignments.slice(from, to + 1).filter((assignment) => !assignment.isBonus);
    if (sourceAssignments.length === 0) {
      return '';
    }

    const firstTitle = sourceAssignments[0].title;
    const lastTitle = sourceAssignments[sourceAssignments.length - 1].title;
    const sourceTitle = firstTitle === lastTitle ? firstTitle : firstTitle + '-' + lastTitle;
    return 'รวม ' + sourceTitle + ' /' + targetMax;
  }

  function handleAssignmentChange() {
    flushVisibleScoreAutosaves();
    state.selectedAssignmentId = byId('assignment-select').value;
    clearScanResults('เปลี่ยนงานแล้ว ล้างผลสแกนเดิมเพื่อกันบันทึกผิดงาน');
    syncAssignmentMaxInput();
    renderScoreEntryGrid();
  }

  function syncAssignmentMaxInput() {
    const titleInput = byId('assignment-title-input');
    const input = byId('assignment-max-input');
    const passInput = byId('assignment-pass-input');
    const visibilityInput = byId('assignment-visibility');
    if (!input && !titleInput) {
      return;
    }

    const assignment = getSelectedAssignment();
    if (titleInput) {
      titleInput.value = assignment ? assignment.title : '';
    }
    if (input) {
      input.value = assignment && assignment.maxScore !== null ? assignment.maxScore : '';
    }
    if (passInput) {
      passInput.value = assignment && assignment.passScore !== null && assignment.passScore !== undefined ? assignment.passScore : '';
    }
    if (visibilityInput) {
      visibilityInput.value = assignment && assignment.visibility ? assignment.visibility : 'both';
    }
  }

  function renderScoreEntryGrid() {
    const body = byId('score-entry-body');
    if (!body) {
      return;
    }

    clearScoreAutosaveTimers();
    body.innerHTML = '';
    const summary = state.latestClassSummary && state.latestClassSummary.summary;
    const assignment = getSelectedAssignment();

    if (!summary || !assignment) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="3">ไม่มีข้อมูล</td>';
      body.appendChild(row);
      return;
    }

    summary.students.forEach((student) => {
      const score = getStudentScore(student, assignment.assignmentId);
      const row = document.createElement('tr');
      row.innerHTML = [td(student.no), '<td></td>', '<td></td>'].join('');

      const nameCell = row.children[1];
      const nameWrap = document.createElement('div');
      nameWrap.className = 'teacher-student-name-cell';
      const fullName = document.createElement('strong');
      fullName.className = 'student-full-name';
      fullName.textContent = student.name;
      const nicknameLabel = document.createElement('label');
      nicknameLabel.className = 'nickname-field';
      const nicknameCaption = document.createElement('span');
      nicknameCaption.textContent = 'ชื่อเล่น';
      const nicknameInput = document.createElement('input');
      nicknameInput.className = 'student-nickname-input';
      nicknameInput.dataset.studentNo = student.no;
      nicknameInput.dataset.lastSavedValue = student.nickname || '';
      nicknameInput.value = student.nickname || '';
      nicknameInput.placeholder = 'ชื่อเล่น';
      nicknameInput.title = 'ชื่อเล่นส่วนตัวของครู';
      nicknameInput.addEventListener('keydown', handleStudentNicknameKeydown);
      nicknameInput.addEventListener('blur', (event) => saveStudentNicknameInput(event.currentTarget, true));
      const nicknameStatus = document.createElement('span');
      nicknameStatus.className = 'nickname-save-status';
      nicknameStatus.textContent = '';
      nicknameLabel.appendChild(nicknameCaption);
      nicknameLabel.appendChild(nicknameInput);
      nicknameLabel.appendChild(nicknameStatus);
      nameWrap.appendChild(fullName);
      nameWrap.appendChild(nicknameLabel);
      nameCell.appendChild(nameWrap);

      const input = document.createElement('input');
      input.className = 'score-input';
      input.dataset.studentNo = student.no;
      input.dataset.assignmentId = assignment.assignmentId;
      input.dataset.lastSavedValue = score ? score.rawValue : '';
      input.inputMode = 'decimal';
      input.value = score ? score.rawValue : '';
      input.addEventListener('keydown', handleScoreInputNavigation);
      input.addEventListener('input', handleScoreInputAutosave);
      input.addEventListener('change', (event) => saveScoreInput(event.currentTarget, true));
      input.addEventListener('blur', (event) => saveScoreInput(event.currentTarget, true));
      if (assignment.maxScore !== null) {
        input.max = assignment.maxScore;
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'score-input-wrap';
      const status = document.createElement('span');
      status.className = 'score-save-status';
      status.textContent = 'บันทึกอัตโนมัติ';
      wrapper.appendChild(input);
      wrapper.appendChild(status);
      row.children[2].appendChild(wrapper);
      body.appendChild(row);
    });
  }

  function clearScoreAutosaveTimers() {
    Object.keys(state.scoreAutosaveTimers || {}).forEach((key) => {
      clearTimeout(state.scoreAutosaveTimers[key]);
    });
    state.scoreAutosaveTimers = {};
  }

  function flushVisibleScoreAutosaves() {
    Array.from(document.querySelectorAll('#score-entry-body .score-input')).forEach((input) => {
      saveScoreInput(input, true);
    });
  }

  function handleScoreInputAutosave(event) {
    const input = event.currentTarget;
    const key = getScoreInputKey(input);
    clearTimeout(state.scoreAutosaveTimers[key]);
    setScoreInputStatus(input, 'pending', 'รอบันทึก');
    state.scoreAutosaveTimers[key] = setTimeout(() => {
      saveScoreInput(input, false);
    }, 900);
  }

  function saveScoreInput(input, force) {
    const assignment = getSelectedAssignment();
    if (!input || !assignment || input.dataset.assignmentId !== assignment.assignmentId || !state.selectedClass) {
      return;
    }

    const key = getScoreInputKey(input);
    clearTimeout(state.scoreAutosaveTimers[key]);
    delete state.scoreAutosaveTimers[key];

    const currentValue = normalizeScoreInputValue(input.value);
    const lastSavedValue = normalizeScoreInputValue(input.dataset.lastSavedValue);
    if (!force && currentValue === lastSavedValue) {
      setScoreInputStatus(input, 'idle', 'บันทึกแล้ว');
      return;
    }
    if (currentValue === lastSavedValue) {
      setScoreInputStatus(input, 'idle', 'บันทึกแล้ว');
      return;
    }

    const className = state.selectedClass;
    const assignmentId = assignment.assignmentId;
    const sequence = Number(input.dataset.saveSequence || 0) + 1;
    input.dataset.saveSequence = String(sequence);
    setScoreInputStatus(input, 'saving', 'กำลังบันทึก...');

    serverCall('teacherSaveAssignmentScores', [state.teacherToken, className, assignmentId, [{
      studentNo: input.dataset.studentNo,
      score: currentValue,
    }]], (result) => {
      if (String(input.dataset.saveSequence || '') !== String(sequence)) {
        return;
      }

      if (normalizeScoreInputValue(input.value) !== currentValue) {
        input.dataset.lastSavedValue = currentValue;
        if (state.selectedClass === className && state.selectedAssignmentId === assignmentId) {
          handleScoreInputAutosave({ currentTarget: input });
        }
        return;
      }

      input.dataset.lastSavedValue = currentValue;
      setScoreInputStatus(input, 'saved', 'บันทึกแล้ว');
      if (state.selectedClass === className) {
        updateLatestSummaryAfterAutosave(result);
      }
    }, (error) => {
      if (String(input.dataset.saveSequence || '') !== String(sequence)) {
        return;
      }

      setScoreInputStatus(input, 'error', 'ยังไม่บันทึก');
      showTeacherWarning((error && error.message) || String(error));
    });
  }

  function getScoreInputKey(input) {
    return [
      state.selectedClass || '',
      input && input.dataset ? input.dataset.assignmentId || '' : '',
      input && input.dataset ? input.dataset.studentNo || '' : '',
    ].join('|');
  }

  function normalizeScoreInputValue(value) {
    return String(value === null || value === undefined ? '' : value).trim();
  }

  function setScoreInputStatus(input, status, text) {
    const wrapper = input ? input.closest('.score-input-wrap') : null;
    const statusBox = wrapper ? wrapper.querySelector('.score-save-status') : null;
    if (!wrapper || !statusBox) {
      return;
    }

    wrapper.dataset.saveStatus = status || 'idle';
    statusBox.textContent = text || '';
  }

  function handleStudentNicknameKeydown(event) {
    const input = event.currentTarget;
    if (event.key === 'Enter') {
      event.preventDefault();
      const row = input.closest('tr');
      const scoreInput = row ? row.querySelector('.score-input') : null;
      if (scoreInput) {
        scoreInput.focus();
        scoreInput.select();
      } else {
        input.blur();
      }
    }
  }

  function saveStudentNicknameInput(input, force) {
    if (!input || !state.selectedClass) {
      return;
    }

    const studentNo = input.dataset.studentNo || '';
    const currentValue = String(input.value || '').trim();
    const lastSavedValue = String(input.dataset.lastSavedValue || '').trim();
    if (!force && currentValue === lastSavedValue) {
      return;
    }
    if (currentValue === lastSavedValue) {
      setStudentNicknameStatus(input, 'idle', 'บันทึกแล้ว');
      return;
    }

    const className = state.selectedClass;
    const sequence = Number(input.dataset.saveSequence || 0) + 1;
    input.dataset.saveSequence = String(sequence);
    setStudentNicknameStatus(input, 'saving', '...');

    serverCall('teacherSaveStudentNickname', [state.teacherToken, className, studentNo, currentValue], (result) => {
      if (String(input.dataset.saveSequence || '') !== String(sequence)) {
        return;
      }

      input.dataset.lastSavedValue = currentValue;
      setStudentNicknameStatus(input, 'saved', '✓');
      updateLatestSummaryAfterStudentNickname(result, studentNo, currentValue);
    }, (error) => {
      if (String(input.dataset.saveSequence || '') !== String(sequence)) {
        return;
      }

      setStudentNicknameStatus(input, 'error', '!');
      showTeacherWarning((error && error.message) || String(error));
    });
  }

  function setStudentNicknameStatus(input, status, text) {
    const field = input ? input.closest('.nickname-field') : null;
    const statusBox = field ? field.querySelector('.nickname-save-status') : null;
    if (!field || !statusBox) {
      return;
    }

    field.dataset.saveStatus = status || 'idle';
    statusBox.textContent = text || '';
    statusBox.title = getStudentNicknameStatusTitle(status);
  }

  function getStudentNicknameStatusTitle(status) {
    if (status === 'saving') {
      return 'กำลังบันทึกชื่อเล่น';
    }
    if (status === 'saved') {
      return 'บันทึกชื่อเล่นแล้ว';
    }
    if (status === 'error') {
      return 'ยังไม่บันทึกชื่อเล่น';
    }
    return '';
  }

  function updateLatestSummaryAfterAutosave(result) {
    if (!result || !result.summary || !state.latestClassSummary) {
      return;
    }

    state.latestClassSummary.summary = result.summary;
    const metricMax = byId('metric-max');
    if (metricMax) {
      metricMax.textContent = formatValue(result.summary.maxTotal);
    }
  }

  function updateLatestSummaryAfterStudentNickname(result, studentNo, nickname) {
    if (result && result.summary && state.latestClassSummary) {
      state.latestClassSummary.summary = result.summary;
      state.latestClassSummary.missing = result.missing || state.latestClassSummary.missing;
      state.latestClassSummary.atRisk = result.atRisk || state.latestClassSummary.atRisk;
      return;
    }

    const students = state.latestClassSummary && state.latestClassSummary.summary
      ? state.latestClassSummary.summary.students || []
      : [];
    students.forEach((student) => {
      if (String(student.no || '') === String(studentNo || '')) {
        student.nickname = nickname;
      }
    });
  }

  function handleScoreInputNavigation(event) {
    if (event.key !== 'Enter' && event.key !== 'Tab') {
      return;
    }

    const inputs = Array.from(document.querySelectorAll('#score-entry-body .score-input'));
    const currentIndex = inputs.indexOf(event.currentTarget);
    const offset = event.shiftKey ? -1 : 1;
    const nextInput = inputs[currentIndex + offset];
    if (!nextInput) {
      return;
    }

    event.preventDefault();
    nextInput.focus();
    nextInput.select();
  }

  function handleSaveScoreGrid() {
    const assignment = getSelectedAssignment();
    if (!assignment) {
      showTeacherWarning('กรุณาเลือกงาน');
      return;
    }

    const entries = Array.from(document.querySelectorAll('#score-entry-body .score-input')).map((input) => ({
      studentNo: input.dataset.studentNo,
      score: input.value.trim(),
    }));

    setBusy('save-score-grid', true);
    showTeacherWarning('กำลังบันทึกคะแนน...');
    serverCall('teacherSaveAssignmentScores', [state.teacherToken, state.selectedClass, assignment.assignmentId, entries], (result) => {
      setBusy('save-score-grid', false);
      Array.from(document.querySelectorAll('#score-entry-body .score-input')).forEach((input) => {
        input.dataset.lastSavedValue = normalizeScoreInputValue(input.value);
        setScoreInputStatus(input, 'saved', 'บันทึกแล้ว');
      });
      showTeacherWarning(result.message || 'บันทึกคะแนนแล้ว');
      loadSelectedClass();
    }, (error) => {
      setBusy('save-score-grid', false);
      showTeacherWarning(error.message || String(error));
    });
  }

  async function handleOpenScanCamera() {
    if (!ensureScanReadyContext()) {
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScanMessage('เบราว์เซอร์นี้บล็อกกล้องแบบวิดีโอ กำลังเปิดกล้องสำรอง...');
      showTeacherWarning('ถ้ากล้องไม่เปิด ให้แตะปุ่ม "กล้องสำรอง" ระบบจะอ่านภาพชั่วคราวและไม่เก็บไฟล์');
      openScanFallbackPicker();
      return;
    }

    try {
      setBusy('open-scan-camera', true);
      setScanMessage('กำลังขออนุญาตใช้กล้อง...');
      if (state.scanCameraStream) {
        handleStopScanCamera();
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      state.scanCameraStream = stream;
      const video = byId('scan-video');
      if (video) {
        video.srcObject = stream;
        video.classList.add('active');
        await video.play();
      }
      setBusy('open-scan-camera', false);
      setScanMessage('เปิดกล้องแล้ว ถือให้นิ่งแล้วกดอ่านภาพ หรือเปิดสแกนอัตโนมัติ');
    } catch (error) {
      setBusy('open-scan-camera', false);
      setScanMessage('เปิดกล้องวิดีโอไม่สำเร็จ: ' + (error.message || String(error)) + ' · ลองแตะ "กล้องสำรอง"');
      showTeacherWarning('มือถือบางรุ่นบล็อกกล้องใน Google Apps Script ให้แตะปุ่ม "กล้องสำรอง" เพื่อถ่าย/เลือกรูปชั่วคราวแทน');
    }
  }

  function handleScanCaptureLabelClick(event) {
    if (!ensureScanReadyContext()) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function handleScanFallbackFileButton() {
    if (!ensureScanReadyContext()) {
      return;
    }
    openScanFallbackPicker();
  }

  function openScanFallbackPicker() {
    const input = byId('scan-image-fallback');
    if (!input) {
      setScanMessage('ไม่พบตัวเปิดกล้องสำรอง');
      return;
    }
    input.value = '';
    input.click();
  }

  function handleScanFallbackImageChange(event) {
    const input = event.currentTarget;
    const file = input && input.files && input.files[0] ? input.files[0] : null;
    if (!file) {
      return;
    }
    if (!ensureScanReadyContext()) {
      input.value = '';
      return;
    }

    setScanMessage('กำลังอ่านข้อความจากภาพชั่วคราว...');
    readFileAsDataUrl(file).then((imageDataUrl) => resizeImageDataUrl(imageDataUrl, 1280, 0.82)).then((imageDataUrl) => {
      input.value = '';
      submitScanImageDataUrl(imageDataUrl, '');
    }).catch((error) => {
      input.value = '';
      setScanMessage('อ่านภาพจากกล้องสำรองไม่สำเร็จ: ' + (error.message || String(error)));
    });
  }

  function handleStopScanCamera() {
    if (state.scanAutoTimer) {
      clearInterval(state.scanAutoTimer);
      state.scanAutoTimer = null;
      setAutoScanButtonText(false);
    }
    if (state.scanCameraStream) {
      state.scanCameraStream.getTracks().forEach((track) => track.stop());
      state.scanCameraStream = null;
    }
    const video = byId('scan-video');
    if (video) {
      video.pause();
      video.srcObject = null;
      video.classList.remove('active');
    }
    setScanMessage('ปิดกล้องแล้ว');
  }

  function handleToggleAutoScan() {
    if (state.scanAutoTimer) {
      clearInterval(state.scanAutoTimer);
      state.scanAutoTimer = null;
      setAutoScanButtonText(false);
      setScanMessage('หยุดสแกนอัตโนมัติแล้ว');
      return;
    }
    if (!state.scanCameraStream) {
      setScanMessage('เปิดกล้องก่อนใช้สแกนอัตโนมัติ');
      return;
    }
    setAutoScanButtonText(true);
    setScanMessage('เริ่มสแกนอัตโนมัติ ถือกล้องให้นิ่งเหนือใบงาน');
    state.scanAutoTimer = setInterval(() => {
      handleScanCurrentFrame(true);
    }, 4200);
    handleScanCurrentFrame(true);
  }

  function setAutoScanButtonText(active) {
    const button = byId('toggle-auto-scan');
    if (button) {
      button.textContent = active ? 'หยุดสแกนอัตโนมัติ' : 'สแกนอัตโนมัติ';
    }
  }

  function handleScanCurrentFrame(fromAuto) {
    if (!ensureScanReadyContext()) {
      return;
    }
    if (!state.scanCameraStream) {
      setScanMessage('เปิดกล้องก่อนสแกนใบงาน');
      return;
    }
    if (state.scanBusy) {
      return;
    }

    const imageDataUrl = captureScanFrameDataUrl();
    if (!imageDataUrl) {
      setScanMessage('ยังจับภาพจากกล้องไม่ได้');
      return;
    }

    const assignment = getSelectedAssignment();
    if (!fromAuto) {
      setScanMessage('AI กำลังอ่านข้อความจากใบงาน...');
    }

    submitScanImageDataUrl(imageDataUrl, 'scan-current-frame', fromAuto);
  }

  function submitScanImageDataUrl(imageDataUrl, busyButtonId, fromAuto) {
    const assignment = getSelectedAssignment();
    if (!assignment || !imageDataUrl || state.scanBusy) {
      return;
    }

    state.scanBusy = true;
    if (busyButtonId) {
      setBusy(busyButtonId, true);
    }
    serverCall('teacherScanWorksheetFrame', [state.teacherToken, {
      className: state.selectedClass,
      assignmentId: assignment.assignmentId,
      imageDataUrl: imageDataUrl,
    }], (result) => {
      state.scanBusy = false;
      if (busyButtonId) {
        setBusy(busyButtonId, false);
      }
      if (!result.success) {
        setScanMessage(result.message || 'AI ยังอ่านภาพนี้ไม่ได้');
        return;
      }
      addScanResult(result);
      setScanMessage(result.statusLabel + (result.studentName ? ': ' + result.studentName : '') + (result.score !== null && result.score !== undefined ? ' ได้ ' + result.score : ''));
    }, (error) => {
      state.scanBusy = false;
      if (busyButtonId) {
        setBusy(busyButtonId, false);
      }
      setScanMessage((error && error.message) || String(error));
    });
  }

  function ensureScanReadyContext() {
    if (!state.selectedClass) {
      setScanMessage('กรุณาเลือกห้องก่อนสแกนใบงาน');
      return false;
    }
    if (!getSelectedAssignment()) {
      setScanMessage('กรุณาเลือกงานก่อนสแกนใบงาน');
      return false;
    }
    return true;
  }

  function captureScanFrameDataUrl() {
    const video = byId('scan-video');
    const canvas = byId('scan-canvas');
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      return '';
    }

    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  }

  function resizeImageDataUrl(imageDataUrl, maxWidth, quality) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, (maxWidth || 1280) / image.width);
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality || 0.82));
      };
      image.onerror = () => reject(new Error('ย่อภาพไม่สำเร็จ'));
      image.src = imageDataUrl;
    });
  }

  function addScanResult(result) {
    const item = {
      scanId: result.scanId || String(Date.now()),
      className: result.className || state.selectedClass,
      assignmentId: result.assignmentId || (getSelectedAssignment() ? getSelectedAssignment().assignmentId : ''),
      status: result.status || 'review',
      statusLabel: result.statusLabel || 'ขอตรวจอีกนิด',
      studentNo: result.studentNo || '',
      studentName: result.studentName || '',
      readStudentNo: result.readStudentNo || '',
      score: result.score === null || result.score === undefined ? '' : String(result.score),
      nameConfidence: result.nameConfidence || 0,
      scoreConfidence: result.scoreConfidence || 0,
      note: result.note || '',
      extractedText: result.extractedText || '',
      alternatives: result.alternatives || [],
      checked: result.status === 'ready',
    };
    const duplicateIndex = state.scanResults.findIndex((existing) =>
      existing.assignmentId === item.assignmentId &&
      item.studentNo &&
      existing.studentNo === item.studentNo
    );
    if (duplicateIndex >= 0) {
      state.scanResults.splice(duplicateIndex, 1, item);
    } else {
      state.scanResults.unshift(item);
    }
    renderScanResults();
  }

  function renderScanResults() {
    const container = byId('scan-results');
    if (!container) {
      return;
    }
    if (!state.scanResults || state.scanResults.length === 0) {
      container.innerHTML = '<div class="list-item">ยังไม่มีผลสแกน</div>';
      return;
    }

    container.innerHTML = state.scanResults.map((item, index) => {
      const confidence = item.nameConfidence ? 'มั่นใจชื่อ ' + item.nameConfidence + '%' : 'ยังไม่มั่นใจชื่อ';
      const note = item.note ? '<p class="scan-note">' + escapeHtml(item.note) + '</p>' : '';
      const text = item.extractedText ? '<details><summary>ข้อความที่ AI อ่านได้</summary><pre>' + escapeHtml(item.extractedText.slice(0, 1200)) + '</pre></details>' : '';
      return [
        '<article class="scan-result" data-scan-index="' + index + '" data-status="' + escapeHtml(item.status) + '">',
        '<div class="scan-result-head">',
        '<label class="scan-check"><input type="checkbox" class="scan-commit" ' + (item.checked ? 'checked' : '') + '> บันทึกรายการนี้</label>',
        '<strong>' + escapeHtml(item.statusLabel) + '</strong>',
        '</div>',
        '<label>นักเรียน</label>',
        '<select class="scan-student">',
        buildScanStudentOptions(item.studentNo),
        '</select>',
        '<label>คะแนน</label>',
        '<input class="scan-score" inputmode="decimal" value="' + escapeHtml(item.score) + '">',
        '<p class="scan-note">' + escapeHtml(confidence) + (item.readStudentNo ? ' · เลขที่ที่อ่านได้ ' + escapeHtml(item.readStudentNo) : '') + '</p>',
        note,
        renderScanAlternatives(item),
        text,
        '<button type="button" class="button-outline scan-remove">ลบรายการนี้</button>',
        '</article>',
      ].join('');
    }).join('');

    container.querySelectorAll('.scan-remove').forEach((button) => {
      button.addEventListener('click', (event) => {
        const card = event.currentTarget.closest('.scan-result');
        const index = Number(card.dataset.scanIndex);
        state.scanResults.splice(index, 1);
        renderScanResults();
      });
    });
  }

  function buildScanStudentOptions(selectedNo) {
    const summary = state.latestClassSummary && state.latestClassSummary.summary;
    const students = summary ? (summary.students || []) : [];
    const options = ['<option value="">เลือกนักเรียน</option>'];
    students.forEach((student) => {
      const selected = String(student.no) === String(selectedNo) ? ' selected' : '';
      options.push('<option value="' + escapeHtml(student.no) + '"' + selected + '>' + escapeHtml(student.no + ' — ' + student.name) + '</option>');
    });
    return options.join('');
  }

  function renderScanAlternatives(item) {
    if (!item.alternatives || item.alternatives.length <= 1) {
      return '';
    }
    const alternatives = item.alternatives.slice(0, 3).map((candidate) =>
      '<span>' + escapeHtml(candidate.no + ' ' + candidate.name + ' (' + candidate.confidence + '%)') + '</span>'
    ).join('');
    return '<div class="scan-alternatives">' + alternatives + '</div>';
  }

  function handleConfirmScanResults() {
    const assignment = getSelectedAssignment();
    if (!assignment) {
      setScanMessage('กรุณาเลือกงานก่อนยืนยันคะแนน');
      return;
    }

    const entries = [];
    const cards = Array.from(document.querySelectorAll('#scan-results .scan-result'));
    cards.forEach((card) => {
      const checked = card.querySelector('.scan-commit') && card.querySelector('.scan-commit').checked;
      const studentNo = card.querySelector('.scan-student') ? card.querySelector('.scan-student').value : '';
      const score = card.querySelector('.scan-score') ? card.querySelector('.scan-score').value.trim() : '';
      if (checked && studentNo && score !== '') {
        entries.push({ studentNo: studentNo, score: score });
      }
    });

    if (entries.length === 0) {
      setScanMessage('ยังไม่มีรายการที่พร้อมบันทึก เลือกนักเรียนและคะแนนก่อน');
      return;
    }

    flushVisibleScoreAutosaves();
    setBusy('confirm-scan-results', true);
    setScanMessage('กำลังบันทึกคะแนนจากผลสแกน...');
    serverCall('teacherSaveAssignmentScores', [state.teacherToken, state.selectedClass, assignment.assignmentId, entries], (result) => {
      setBusy('confirm-scan-results', false);
      setScanMessage(result.message || 'บันทึกคะแนนจากผลสแกนแล้ว');
      state.scanResults = [];
      renderScanResults();
      loadSelectedClass();
    }, (error) => {
      setBusy('confirm-scan-results', false);
      setScanMessage((error && error.message) || String(error));
    });
  }

  function setScanMessage(message) {
    const box = byId('scan-message');
    if (box) {
      box.textContent = message || '';
    }
  }

  function clearScanResults(message) {
    state.scanResults = [];
    renderScanResults();
    if (message) {
      setScanMessage(message);
    }
  }

  function handleUpdateMaxScore() {
    const assignment = getSelectedAssignment();
    if (!assignment) {
      showTeacherWarning('กรุณาเลือกงาน');
      return;
    }

    const title = byId('assignment-title-input').value.trim();
    const maxScore = byId('assignment-max-input').value.trim();
    const passScore = byId('assignment-pass-input').value.trim();
    const visibility = byId('assignment-visibility').value;
    setBusy('update-max-score', true);
    showTeacherWarning('กำลังบันทึกงาน...');
    serverCall('teacherUpdateAssignmentRules', [state.teacherToken, state.selectedClass, assignment.assignmentId, maxScore, passScore, visibility, title], (result) => {
      setBusy('update-max-score', false);
      showTeacherWarning(result.message || 'บันทึกงานแล้ว');
      loadSelectedClass();
    }, (error) => {
      setBusy('update-max-score', false);
      showTeacherWarning(error.message || String(error));
    });
  }

  function handleAddAssignment() {
    if (!state.selectedClass) {
      showTeacherWarning('กรุณาเลือกห้อง/กลุ่มเรียนก่อนเพิ่มงาน');
      return;
    }

    const payload = {
      title: byId('new-assignment-title').value.trim(),
      maxScore: byId('new-assignment-max').value.trim(),
      passScore: byId('new-assignment-pass').value.trim(),
      visibility: byId('new-assignment-visibility').value,
    };

    setBusy('add-assignment', true);
    showTeacherWarning('กำลังเพิ่มงาน...');
    serverCall('teacherAddAssignment', [state.teacherToken, state.selectedClass, payload], (result) => {
      setBusy('add-assignment', false);
      state.selectedAssignmentId = result.assignmentId || '';
      byId('new-assignment-title').value = '';
      byId('new-assignment-max').value = '';
      byId('new-assignment-pass').value = '';
      byId('new-assignment-visibility').value = 'both';
      showTeacherWarning(result.message || 'เพิ่มงานแล้ว');
      loadSelectedClass();
    }, (error) => {
      setBusy('add-assignment', false);
      showTeacherWarning(error.message || String(error));
    });
  }

  function handleScaleScores() {
    const payload = {
      sourceStartAssignmentId: byId('scale-start-assignment').value,
      sourceEndAssignmentId: byId('scale-end-assignment').value,
      targetAssignmentId: byId('scale-target-assignment').value,
      targetTitle: byId('scale-target-title').value.trim(),
      targetMaxScore: byId('scale-target-max').value.trim(),
      decimals: byId('scale-decimals').value,
    };

    if (!payload.sourceStartAssignmentId || !payload.sourceEndAssignmentId) {
      showTeacherWarning('กรุณาเลือกช่วงงานต้นทาง');
      return;
    }

    setBusy('scale-scores', true);
    showTeacherWarning('กำลังคำนวณและบันทึกคะแนน...');
    serverCall('teacherScaleAssignmentScores', [state.teacherToken, state.selectedClass, payload], (result) => {
      setBusy('scale-scores', false);
      state.selectedAssignmentId = result.assignmentId || state.selectedAssignmentId;
      const titleInput = byId('scale-target-title');
      if (titleInput) {
        titleInput.dataset.autoTitle = 'true';
      }
      showTeacherWarning(result.message || 'คำนวณคะแนนแล้ว');
      loadSelectedClass();
    }, (error) => {
      setBusy('scale-scores', false);
      showTeacherWarning(error.message || String(error));
    });
  }

  function handleDownloadCsv() {
    setBusy('download-csv', true);
    serverCall('teacherExportClassCsv', [state.teacherToken, state.selectedClass], (result) => {
      setBusy('download-csv', false);
      downloadTextFile(result.filename || 'scores.csv', '\ufeff' + (result.csv || ''), 'text/csv;charset=utf-8');
    }, (error) => {
      setBusy('download-csv', false);
      showTeacherWarning(error.message || String(error));
    });
  }

  function handleBuildSgsSummary() {
    setBusy('build-sgs-summary', true);
    showTeacherWarning('กำลังสร้างสรุปสำหรับ SGS...');
    serverCall('teacherBuildSgsSummary', [state.teacherToken, state.selectedClass], (result) => {
      setBusy('build-sgs-summary', false);
      state.latestSgsExport = result;
      byId('sgs-output').value = result.copyText || '';
      showTeacherWarning('สร้างสรุป SGS แล้ว สามารถคัดลอกไปวางได้เลย');
    }, (error) => {
      setBusy('build-sgs-summary', false);
      showTeacherWarning(error.message || String(error));
    });
  }

  function handleCopySgsSummary() {
    const output = byId('sgs-output');
    const text = output ? output.value : '';
    if (!text) {
      showTeacherWarning('กรุณาสร้างสรุป SGS ก่อน');
      return;
    }

    copyTextToClipboard(text, () => {
      showTeacherWarning('คัดลอกสรุป SGS แล้ว');
    });
  }

  function handleDownloadSgsCsv() {
    if (!state.latestSgsExport || !state.latestSgsExport.csv) {
      showTeacherWarning('กรุณาสร้างสรุป SGS ก่อน');
      return;
    }

    downloadTextFile(
      state.latestSgsExport.filename || 'sgs_summary.csv',
      '\ufeff' + state.latestSgsExport.csv,
      'text/csv;charset=utf-8'
    );
  }

  function getSelectedAssignment() {
    const assignments = getCurrentAssignments();
    return assignments.find((assignment) => assignment.assignmentId === state.selectedAssignmentId) || null;
  }

  function getCurrentAssignments() {
    const summary = state.latestClassSummary && state.latestClassSummary.summary;
    return summary ? (summary.assignments || []) : [];
  }

  function formatAssignmentLabel(assignment, index) {
    return (index + 1) + '. ' + assignment.title + (assignment.isBonus ? ' (พิเศษ)' : '');
  }

  function getStudentScore(student, assignmentId) {
    return (student.scores || []).find((score) => score.assignmentId === assignmentId) || null;
  }

  function loadTeacherStudentDetail() {
    const studentNo = byId('student-no-input').value.trim();
    if (!studentNo) {
      return;
    }
    serverCall('teacherGetStudentDetail', [state.teacherToken, state.selectedClass, studentNo], (data) => {
      byId('report-output').value = buildQuickSummary(data.student);
    }, showTeacherWarning);
  }

  function makeTeacherReport(type) {
    const studentNo = byId('student-no-input').value.trim();
    if (!studentNo) {
      showTeacherWarning('กรุณากรอกเลขที่นักเรียน');
      return;
    }
    serverCall('teacherGenerateReport', [state.teacherToken, state.selectedClass, studentNo, type], (result) => {
      byId('report-output').value = result.message;
    }, showTeacherWarning);
  }

  function handleStudentLogin() {
    const payload = {
      className: byId('student-class').value,
      studentNo: byId('student-no').value,
      pin: byId('student-pin').value,
      teacherUsername: byId('student-teacher-username').value,
    };
    if (!payload.teacherUsername) {
      setStudentMessage('กรุณาเลือกครูผู้สอน');
      return;
    }
    if (!payload.className) {
      setStudentMessage('กรุณาเลือกห้องเรียน');
      return;
    }
    if (!payload.studentNo) {
      setStudentMessage('กรุณาเลือกเลขที่ / ชื่อนักเรียน');
      return;
    }
    if (!payload.pin) {
      setStudentMessage('กรุณากรอกรหัสเข้าใช้');
      return;
    }

    setStudentMessage('กำลังเข้าสู่ระบบ...');
    setBusy('student-login-button', true);
    serverCall('studentLogin', [payload], (result) => {
      setBusy('student-login-button', false);
      if (!result.success) {
        setStudentMessage(result.message || 'เข้าสู่ระบบไม่สำเร็จ');
        return;
      }
      state.studentToken = result.token;
      sessionStorage.setItem('studentToken', result.token);
      renderStudentDashboard(result.dashboard);
    }, (error) => {
      setBusy('student-login-button', false);
      showStudentError(error);
    });
  }

  function renderStudentDashboard(dashboard) {
    const student = dashboard.student;
    byId('student-login').classList.toggle('hidden', true);
    byId('student-dashboard').classList.toggle('hidden', false);
    byId('student-class-label').textContent = 'ห้อง ' + student.className + ' เลขที่ ' + student.no;
    byId('student-name').textContent = student.name;
    byId('student-grade').textContent = student.estimatedGrade;
    byId('student-total').textContent = formatValue(student.totalScore);
    byId('student-percent').textContent = formatPercent(student.percent);
    byId('student-missing-count').textContent = student.enteredScoreCount || 0;
    byId('student-note').textContent = student.note || '-';

    const body = byId('student-score-body');
    body.innerHTML = '';
    if (!student.scores || student.scores.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = '<td colspan="4">ยังไม่มีรายการคะแนน</td>';
      body.appendChild(emptyRow);
    }
    (student.scores || []).forEach((score) => {
      const row = document.createElement('tr');
      const visibility = score.visibility || 'both';
      const scoreText = visibility === 'status' ? 'ครูซ่อนคะแนนไว้' : (score.rawValue || '-');
      const passText = visibility === 'score' ? '-' : formatValue(score.passScore);
      const statusText = visibility === 'score' ? '-' : renderStudentStatusBadge(score.status);
      row.innerHTML = [
        td(score.title),
        td(scoreText),
        td(passText),
        td(statusText, visibility !== 'score'),
      ].join('');
      if (score.status && score.status.code) {
        row.dataset.status = score.status.code;
      }
      body.appendChild(row);
    });

    renderList('student-missing-list', student.missingAssignments, (assignment) =>
      '<strong>' + escapeHtml(assignment.title) + '</strong><span>คะแนนเต็ม ' + formatValue(assignment.maxScore) + '</span>'
    );
  }

  function renderStudentStatusBadge(status) {
    if (!status || !status.label) {
      return '-';
    }

    return '<span class="student-status-badge" data-status="' + escapeHtml(status.code || 'recorded') + '">' +
      escapeHtml(status.label) +
      '</span>';
  }

  function handleChangeStudentPin() {
    const payload = {
      currentPin: byId('student-current-pin').value,
      newPin: byId('student-new-pin').value,
      confirmPin: byId('student-confirm-pin').value,
    };

    setBusy('change-pin-button', true);
    setStudentPinMessage('กำลังเปลี่ยนรหัส...');
    serverCall('studentChangePin', [state.studentToken, payload], (result) => {
      setBusy('change-pin-button', false);
      byId('student-current-pin').value = '';
      byId('student-new-pin').value = '';
      byId('student-confirm-pin').value = '';
      setStudentPinMessage(result.message || 'เปลี่ยนรหัสเรียบร้อยแล้ว');
    }, (error) => {
      setBusy('change-pin-button', false);
      setStudentPinMessage(error.message || String(error));
    });
  }

  function buildQuickSummary(student) {
    return [
      'นักเรียน: ' + student.name,
      'ห้อง: ' + student.className + ' เลขที่ ' + student.no,
      'คะแนนรวมที่กรอกแล้ว: ' + formatValue(student.totalScore),
      'เต็มเฉพาะงานที่กรอกแล้ว: ' + formatValue(student.maxTotal),
      'ร้อยละจากงานที่กรอกแล้ว: ' + formatPercent(student.percent),
      'เกรดคาดการณ์: ' + student.estimatedGrade,
      'งานค้าง: ' + student.missingCount + ' งาน',
    ].join('\n');
  }

  function renderList(id, items, renderItem) {
    const container = byId(id);
    container.innerHTML = '';
    if (!items || items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'list-item';
      empty.textContent = 'ไม่มีข้อมูล';
      container.appendChild(empty);
      return;
    }
    items.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = renderItem(item);
      container.appendChild(div);
    });
  }

  function serverCall(name, args, onSuccess, onFailure) {
    if (!window.google || !google.script || !google.script.run) {
      serverCallViaGithubPages(name, args, onSuccess, onFailure);
      return;
    }

    google.script.run
      .withSuccessHandler(onSuccess)
      .withFailureHandler((error) => {
        if (onFailure) {
          onFailure(error);
        }
      })[name].apply(null, args || []);
  }

  function serverCallViaGithubPages(name, args, onSuccess, onFailure) {
    const apiUrl = getGithubPagesApiUrl();
    if (!apiUrl) {
      const error = new Error('ยังไม่ได้ตั้งค่า URL หลังบ้าน Apps Script สำหรับหน้าเว็บ GitHub Pages');
      if (onFailure) {
        onFailure(error);
      }
      return;
    }

    bindGithubPagesRpcListener();

    const requestId = 'rpc_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const iframeName = 'apps_script_rpc_' + requestId;
    const iframe = document.createElement('iframe');
    iframe.name = iframeName;
    iframe.title = 'Apps Script request';
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.border = '0';

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = apiUrl;
    form.target = iframeName;
    form.acceptCharset = 'UTF-8';
    form.style.display = 'none';

    const payloadInput = document.createElement('textarea');
    payloadInput.name = 'payload';
    payloadInput.value = JSON.stringify({
      requestId: requestId,
      action: name,
      args: args || [],
      origin: getGithubPagesMessageOrigin(),
    });
    form.appendChild(payloadInput);

    const cleanup = () => {
      delete window.__appsScriptRpcCallbacks[requestId];
      if (form.parentNode) {
        form.parentNode.removeChild(form);
      }
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      if (onFailure) {
        onFailure(new Error('หลังบ้านตอบกลับช้าเกินไป กรุณาลองอีกครั้ง'));
      }
    }, 180000);

    window.__appsScriptRpcCallbacks[requestId] = (message) => {
      window.clearTimeout(timeout);
      cleanup();
      if (message.ok) {
        if (onSuccess) {
          onSuccess(message.result);
        }
        return;
      }

      if (onFailure) {
        onFailure(new Error(message.error && message.error.message ? message.error.message : 'เรียกหลังบ้านไม่สำเร็จ'));
      }
    };

    document.body.appendChild(iframe);
    document.body.appendChild(form);
    form.submit();
  }

  function getGithubPagesApiUrl() {
    return String(window.APP_API_URL || window.APPS_SCRIPT_API_URL || '').trim();
  }

  function getGithubPagesMessageOrigin() {
    return window.location.origin && window.location.origin !== 'null'
      ? window.location.origin
      : '*';
  }

  function bindGithubPagesRpcListener() {
    if (window.__appsScriptRpcListenerBound) {
      return;
    }

    window.__appsScriptRpcListenerBound = true;
    window.__appsScriptRpcCallbacks = window.__appsScriptRpcCallbacks || {};
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (!message || message.appsScriptRpc !== true || !message.requestId) {
        return;
      }

      const callback = window.__appsScriptRpcCallbacks[message.requestId];
      if (callback) {
        callback(message);
      }
    });
  }

  function downloadTextFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function copyTextToClipboard(text, onDone) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onDone).catch(() => fallbackCopyText(text, onDone));
      return;
    }

    fallbackCopyText(text, onDone);
  }

  function fallbackCopyText(text, onDone) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    if (onDone) {
      onDone();
    }
  }

  function bindClick(id, handler) {
    const element = byId(id);
    if (element) {
      element.addEventListener('click', handler);
    }
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function setBusy(id, busy) {
    const element = byId(id);
    if (element) {
      element.disabled = busy;
    }
  }

  function setTeacherMessage(message) {
    byId('teacher-login-message').textContent = message || '';
  }

  function setTeacherRegisterMessage(message) {
    const box = byId('teacher-register-message');
    if (box) {
      box.textContent = message || '';
    }
  }

  function setStudentMessage(message) {
    byId('student-login-message').textContent = message || '';
  }

  function setStudentPinMessage(message) {
    const box = byId('student-pin-message');
    if (box) {
      box.textContent = message || '';
    }
  }

  function showTeacherWarning(error) {
    const message = typeof error === 'string' ? error : (error && error.message) || String(error);
    const box = byId('teacher-warning');
    if (box) {
      box.textContent = message;
      box.classList.toggle('hidden', !message);
    }
  }

  function showStudentError(error) {
    setStudentMessage((error && error.message) || String(error));
  }

  function td(value, html) {
    return '<td>' + (html ? value : escapeHtml(value)) + '</td>';
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatValue(value) {
    return value === null || value === undefined || value === '' ? '-' : value;
  }

  function formatPercent(value) {
    return value === null || value === undefined ? '-' : value + '%';
  }
