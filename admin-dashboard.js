document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Loading Sorvide Admin Dashboard...');
    
    // ========== CONFIGURATION ==========
    const CONFIG = {
        BACKEND_API: 'https://sorvide-backend.onrender.com/api',
        ADMIN_TOKEN: 'SorvAdm!2024@Sec#Key', // Replace with your token
        
        // License types
        LICENSE_TYPES: {
            '3': '3-day Trial',
            '7': '7-day Trial',
            '30': 'Monthly',
            '365': 'Yearly'
        }
    };
    
    // ========== STATE ==========
    let state = {
        isAuthenticated: false,
        licenses: [],
        filteredLicenses: [],
        selectedLicense: null,
        selectedDuration: 30,
        searchQuery: '',
        currentFilter: 'all',
        adminToken: ''
    };
    
    // ========== DOM ELEMENTS ==========
    const elements = {
        // Login screen
        loginScreen: document.getElementById('loginScreen'),
        adminPassword: document.getElementById('adminPassword'),
        loginBtn: document.getElementById('loginBtn'),
        loginError: document.getElementById('loginError'),
        
        // Dashboard
        adminDashboard: document.getElementById('adminDashboard'),
        logoutBtn: document.getElementById('logoutBtn'),
        totalLicenses: document.getElementById('totalLicenses'),
        activeLicenses: document.getElementById('activeLicenses'),
        monthlyRevenue: document.getElementById('monthlyRevenue'),
        recentActivityCount: document.getElementById('recentActivityCount'),
        searchLicenses: document.getElementById('searchLicenses'),
        licenseTableBody: document.getElementById('licenseTableBody'),
        customerEmail: document.getElementById('customerEmail'),
        customerName: document.getElementById('customerName'),
        generateKeyBtn: document.getElementById('generateKeyBtn'),
        generatedKeySection: document.getElementById('generatedKeySection'),
        generatedKey: document.getElementById('generatedKey'),
        copyKeyBtn: document.getElementById('copyKeyBtn'),
        sendEmailBtn: document.getElementById('sendEmailBtn'),
        saveToDBBtn: document.getElementById('saveToDBBtn'),
        licenseDetailsModal: document.getElementById('licenseDetailsModal'),
        deactivateModal: document.getElementById('deactivateModal'),
        confirmDeactivate: document.getElementById('confirmDeactivate'),
        cancelDeactivate: document.getElementById('cancelDeactivate'),
        recentActivity: document.getElementById('recentActivity'),
        
        // Quick actions
        refreshData: document.getElementById('refreshData'),
        viewAllCustomers: document.getElementById('viewAllCustomers'),
        exportData: document.getElementById('exportData'),
        systemHealth: document.getElementById('systemHealth')
    };
    
    // ========== UTILITY FUNCTIONS ==========
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 
                             type === 'error' ? 'exclamation-circle' : 
                             type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    function formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return 'Invalid date';
        }
    }
    
    function formatDaysLeft(expiryDate) {
        try {
            const expiry = new Date(expiryDate);
            const now = new Date();
            const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
            
            if (daysLeft <= 0) return 'Expired';
            if (daysLeft === 1) return '1 day left';
            return `${daysLeft} days left`;
        } catch (e) {
            return 'Unknown';
        }
    }
    
    function getLicenseStatus(license) {
        if (!license.isActive) return 'Inactive';
        
        try {
            const expiryDate = new Date(license.expiresAt);
            const now = new Date();
            
            if (expiryDate < now) return 'Expired';
            return 'Active';
        } catch (e) {
            return 'Unknown';
        }
    }
    
    function getStatusBadge(status) {
        const badges = {
            'Active': 'status-active',
            'Inactive': 'status-inactive',
            'Expired': 'status-expired',
            'Unknown': 'status-inactive'
        };
        
        return `<span class="status-badge ${badges[status] || 'status-inactive'}">${status}</span>`;
    }
    
    function truncateText(text, maxLength = 20) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
    
    // ========== API FUNCTIONS ==========
    async function fetchWithAuth(url, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'x-admin-token': state.adminToken,
            ...options.headers
        };
        
        try {
            const response = await fetch(`${CONFIG.BACKEND_API}${url}`, {
                ...options,
                headers
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    showNotification('Session expired. Please login again.', 'error');
                    logout();
                    throw new Error('Unauthorized');
                }
                throw new Error(`API Error: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            if (error.message !== 'Unauthorized') {
                showNotification('Failed to connect to server', 'error');
            }
            throw error;
        }
    }
    
    async function checkAdminAuth(token) {
        try {
            const response = await fetch(`${CONFIG.BACKEND_API}/admin/check-auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            
            return await response.json();
        } catch (error) {
            console.error('Auth check error:', error);
            return { success: false, error: 'Network error' };
        }
    }
    
    async function loadDashboardData() {
        try {
            showNotification('Loading dashboard data...', 'info');
            
            // Load stats
            const statsResponse = await fetchWithAuth('/admin/stats');
            if (statsResponse.success) {
                updateDashboardStats(statsResponse.stats);
            }
            
            // Load licenses
            await loadLicenses();
            
            // Load recent activity
            await loadRecentActivity();
            
            showNotification('Dashboard data loaded successfully', 'success');
            
        } catch (error) {
            console.error('Dashboard data load error:', error);
            if (!error.message.includes('Unauthorized')) {
                showNotification('Failed to load dashboard data', 'error');
            }
        }
    }
    
    async function loadLicenses() {
        try {
            const queryParams = new URLSearchParams({
                filter: state.currentFilter,
                search: state.searchQuery
            }).toString();
            
            const data = await fetchWithAuth(`/admin/licenses?${queryParams}`);
            
            if (data.success) {
                state.licenses = data.licenses || [];
                state.filteredLicenses = [...state.licenses];
                renderLicenseTable();
            } else {
                throw new Error(data.error || 'Failed to load licenses');
            }
        } catch (error) {
            console.error('License load error:', error);
            if (!error.message.includes('Unauthorized')) {
                showNotification('Failed to load licenses', 'error');
                // Show empty state
                state.licenses = [];
                state.filteredLicenses = [];
                renderLicenseTable();
            }
        }
    }
    
    async function loadRecentActivity() {
        try {
            const data = await fetchWithAuth('/admin/activity');
            
            if (data.success) {
                renderRecentActivity(data.activities || []);
            }
        } catch (error) {
            console.error('Activity load error:', error);
            // Show empty activity state
            renderRecentActivity([]);
        }
    }
    
    async function generateLicenseKey(email, name, days) {
        try {
            showNotification('Generating license key...', 'info');
            
            const response = await fetchWithAuth('/admin/create-license', {
                method: 'POST',
                body: JSON.stringify({
                    email: email,
                    name: name,
                    days: days
                })
            });
            
            if (response.success) {
                showNotification('License key generated successfully!', 'success');
                return response.license;
            } else {
                throw new Error(response.error || 'Failed to generate key');
            }
        } catch (error) {
            console.error('Key generation error:', error);
            showNotification('Failed to generate key: ' + error.message, 'error');
            throw error;
        }
    }
    
    async function deactivateLicense(licenseKey) {
        try {
            const response = await fetchWithAuth('/admin/deactivate-license', {
                method: 'POST',
                body: JSON.stringify({ licenseKey })
            });
            
            if (response.success) {
                // Update local state
                const licenseIndex = state.licenses.findIndex(l => l.licenseKey === licenseKey);
                if (licenseIndex !== -1) {
                    state.licenses[licenseIndex].isActive = false;
                    state.filteredLicenses = [...state.licenses];
                    renderLicenseTable();
                    updateDashboardStatsFromLocal();
                }
                
                return true;
            } else {
                throw new Error(response.error || 'Failed to deactivate');
            }
        } catch (error) {
            console.error('Deactivation error:', error);
            showNotification('Failed to deactivate license', 'error');
            return false;
        }
    }
    
    // ========== UI UPDATE FUNCTIONS ==========
    function updateDashboardStats(stats) {
        elements.totalLicenses.textContent = stats.totalLicenses || 0;
        elements.activeLicenses.textContent = stats.activeLicenses || 0;
        elements.monthlyRevenue.textContent = `$${(stats.monthlyRevenue || 0).toFixed(2)}`;
        elements.recentActivityCount.textContent = stats.recentActivity || 0;
    }
    
    function updateDashboardStatsFromLocal() {
        const total = state.licenses.length;
        const active = state.licenses.filter(l => {
            if (!l.isActive) return false;
            try {
                return new Date(l.expiresAt) > new Date();
            } catch (e) {
                return false;
            }
        }).length;
        
        const monthly = state.licenses.filter(l => 
            l.isActive && 
            (l.plan === 'monthly' || l.days === 30) &&
            new Date(l.expiresAt) > new Date()
        ).length;
        
        const revenue = monthly * 9.99;
        
        elements.totalLicenses.textContent = total;
        elements.activeLicenses.textContent = active;
        elements.monthlyRevenue.textContent = `$${revenue.toFixed(2)}`;
    }
    
    function renderLicenseTable() {
        const tableBody = elements.licenseTableBody;
        
        if (state.filteredLicenses.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        <i class="fas fa-inbox" style="font-size: 32px; margin-bottom: 10px; display: block; opacity: 0.5;"></i>
                        No licenses found
                        ${state.searchQuery ? ` for "${state.searchQuery}"` : ''}
                    </td>
                </tr>
            `;
            return;
        }
        
        let html = '';
        state.filteredLicenses.forEach(license => {
            const status = getLicenseStatus(license);
            const daysLeft = formatDaysLeft(license.expiresAt);
            const planName = CONFIG.LICENSE_TYPES[license.days] || license.plan || 'Monthly';
            
            html += `
                <tr>
                    <td>
                        <div class="license-key-display" title="Click to copy: ${license.licenseKey}" 
                             onclick="copyToClipboard('${license.licenseKey}')">
                            ${truncateText(license.licenseKey, 20)}
                        </div>
                    </td>
                    <td>
                        <div style="font-weight: 600;">${truncateText(license.customerName || 'No name', 15)}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">${truncateText(license.customerEmail, 20)}</div>
                    </td>
                    <td>${planName}</td>
                    <td>${getStatusBadge(status)}</td>
                    <td>
                        <div>${formatDate(license.expiresAt)}</div>
                        <div style="font-size: 12px; color: ${daysLeft.includes('Expired') ? 'var(--accent-red)' : 'var(--accent-green)'}">
                            ${daysLeft}
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-primary btn-small view-details" data-key="${license.licenseKey}">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-danger btn-small deactivate-license" data-key="${license.licenseKey}" 
                                    ${!license.isActive ? 'disabled style="opacity: 0.5;"' : ''}>
                                <i class="fas fa-power-off"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html;
        
        // Add event listeners
        document.querySelectorAll('.view-details').forEach(btn => {
            btn.addEventListener('click', function() {
                const licenseKey = this.dataset.key;
                showLicenseDetails(licenseKey);
            });
        });
        
        document.querySelectorAll('.deactivate-license').forEach(btn => {
            if (!btn.disabled) {
                btn.addEventListener('click', function() {
                    const licenseKey = this.dataset.key;
                    showDeactivateModal(licenseKey);
                });
            }
        });
    }
    
    function renderRecentActivity(activities) {
        const container = elements.recentActivity;
        
        if (activities.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <i class="fas fa-history" style="font-size: 32px; margin-bottom: 10px; opacity: 0.5;"></i>
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        activities.slice(0, 10).forEach(activity => {
            const iconClass = activity.type || 'validation';
            const icon = activity.type === 'license_created' ? 'fa-key' :
                        activity.type === 'license_deactivated' ? 'fa-power-off' : 'fa-check-circle';
            
            const title = activity.type === 'license_created' ? 'License Created' :
                         activity.type === 'license_deactivated' ? 'License Deactivated' : 'Validation';
            
            html += `
                <div class="activity-item">
                    <div class="activity-icon ${iconClass}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">${title}</div>
                        <div class="activity-details">${truncateText(activity.details || 'No details', 40)}</div>
                        <div class="activity-time">${formatDate(activity.timestamp || activity.createdAt)}</div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    function filterLicenses() {
        let filtered = [...state.licenses];
        
        // Apply search filter
        if (state.searchQuery) {
            const query = state.searchQuery.toLowerCase();
            filtered = filtered.filter(license =>
                (license.licenseKey && license.licenseKey.toLowerCase().includes(query)) ||
                (license.customerEmail && license.customerEmail.toLowerCase().includes(query)) ||
                (license.customerName && license.customerName.toLowerCase().includes(query))
            );
        }
        
        // Apply status filter
        if (state.currentFilter !== 'all') {
            filtered = filtered.filter(license => {
                const status = getLicenseStatus(license);
                switch(state.currentFilter) {
                    case 'active':
                        return status === 'Active';
                    case 'expired':
                        return status === 'Expired';
                    case 'inactive':
                        return status === 'Inactive';
                    case 'monthly':
                        return license.plan === 'monthly' || license.days === 30;
                    default:
                        return true;
                }
            });
        }
        
        state.filteredLicenses = filtered;
        renderLicenseTable();
    }
    
    // ========== MODAL FUNCTIONS ==========
    function showLicenseDetails(licenseKey) {
        const license = state.licenses.find(l => l.licenseKey === licenseKey);
        if (!license) return;
        
        const status = getLicenseStatus(license);
        const daysLeft = formatDaysLeft(license.expiresAt);
        const createdDate = formatDate(license.createdAt);
        const expiryDate = formatDate(license.expiresAt);
        const lastValidated = license.lastValidated ? formatDate(license.lastValidated) : 'Never';
        const validationCount = license.validationCount || 0;
        const planName = CONFIG.LICENSE_TYPES[license.days] || license.plan || 'Monthly';
        
        const content = `
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px; color: var(--text-primary);">License Information</h4>
                <div style="background: var(--background-light); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <div class="key-value" style="font-size: 16px; text-align: center; cursor: pointer;" 
                         onclick="copyToClipboard('${license.licenseKey}')">
                        ${license.licenseKey}
                        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 5px;">
                            <i class="fas fa-copy"></i> Click to copy
                        </div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 5px;">Status</div>
                        <div>${getStatusBadge(status)}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 5px;">Days Left</div>
                        <div style="font-weight: 600; color: ${daysLeft.includes('Expired') ? 'var(--accent-red)' : 'var(--accent-green)'}">
                            ${daysLeft}
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px; color: var(--text-primary);">Customer Details</h4>
                <div style="background: var(--background-light); padding: 15px; border-radius: 8px;">
                    <div style="margin-bottom: 10px;">
                        <div style="font-size: 12px; color: var(--text-secondary);">Name</div>
                        <div style="font-weight: 600;">${license.customerName || 'Not provided'}</div>
                    </div>
                    <div style="margin-bottom: 10px;">
                        <div style="font-size: 12px; color: var(--text-secondary);">Email</div>
                        <div style="font-weight: 600;">${license.customerEmail}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Device</div>
                        <div style="font-weight: 600;">${license.deviceName || 'Unknown'} (${license.deviceId || 'No device'})</div>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px; color: var(--text-primary);">License Details</h4>
                <div style="background: var(--background-light); padding: 15px; border-radius: 8px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary);">Plan</div>
                            <div style="font-weight: 600;">${planName}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary);">Created</div>
                            <div style="font-weight: 600;">${createdDate}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary);">Expires</div>
                            <div style="font-weight: 600;">${expiryDate}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary);">Last Validated</div>
                            <div style="font-weight: 600;">${lastValidated}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary);">Validations</div>
                            <div style="font-weight: 600;">${validationCount}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary);">Active</div>
                            <div style="font-weight: 600;">${license.isActive ? 'Yes' : 'No'}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="action-buttons" style="margin-top: 20px;">
                <button class="btn btn-danger" id="deactivateFromDetails" data-key="${license.licenseKey}" 
                        ${!license.isActive ? 'disabled style="opacity: 0.5;"' : ''}>
                    <i class="fas fa-power-off"></i> Deactivate License
                </button>
                <button class="btn" id="closeDetails">Close</button>
            </div>
        `;
        
        document.getElementById('licenseDetailsContent').innerHTML = content;
        elements.licenseDetailsModal.classList.add('active');
        
        // Add event listeners
        document.getElementById('deactivateFromDetails').addEventListener('click', function() {
            if (!this.disabled) {
                elements.licenseDetailsModal.classList.remove('active');
                showDeactivateModal(license.licenseKey);
            }
        });
        
        document.getElementById('closeDetails').addEventListener('click', function() {
            elements.licenseDetailsModal.classList.remove('active');
        });
    }
    
    function showDeactivateModal(licenseKey) {
        state.selectedLicense = licenseKey;
        elements.deactivateModal.classList.add('active');
    }
    
    function hideModals() {
        elements.licenseDetailsModal.classList.remove('active');
        elements.deactivateModal.classList.remove('active');
    }
    
    // ========== AUTHENTICATION FUNCTIONS ==========
    async function login() {
        const password = elements.adminPassword.value.trim();
        
        if (!password) {
            showLoginError('Please enter the admin password');
            return;
        }
        
        elements.loginBtn.disabled = true;
        elements.loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
        
        try {
            const result = await checkAdminAuth(password);
            
            if (result.success) {
                // Success
                state.isAuthenticated = true;
                state.adminToken = password;
                
                // Store token in session storage
                sessionStorage.setItem('sorvide_admin_token', password);
                
                // Show dashboard
                elements.loginScreen.style.display = 'none';
                elements.adminDashboard.style.display = 'block';
                
                // Load dashboard data
                loadDashboardData();
                
                showNotification('Admin login successful!', 'success');
                
            } else {
                showLoginError(result.error || 'Invalid password');
            }
            
        } catch (error) {
            showLoginError('Network error. Please try again.');
        } finally {
            elements.loginBtn.disabled = false;
            elements.loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Access Dashboard';
        }
    }
    
    function showLoginError(message) {
        elements.loginError.textContent = message;
        elements.loginError.style.display = 'block';
        elements.adminPassword.focus();
        
        // Clear error after 5 seconds
        setTimeout(() => {
            elements.loginError.style.display = 'none';
        }, 5000);
    }
    
    function logout() {
        state.isAuthenticated = false;
        state.adminToken = '';
        sessionStorage.removeItem('sorvide_admin_token');
        
        // Clear inputs
        elements.adminPassword.value = '';
        
        // Show login screen
        elements.loginScreen.style.display = 'flex';
        elements.adminDashboard.style.display = 'none';
        
        // Reset dashboard state
        state.licenses = [];
        state.filteredLicenses = [];
        
        showNotification('Logged out successfully', 'info');
    }
    
    function checkExistingSession() {
        const savedToken = sessionStorage.getItem('sorvide_admin_token');
        
        if (savedToken) {
            state.adminToken = savedToken;
            state.isAuthenticated = true;
            
            elements.loginScreen.style.display = 'none';
            elements.adminDashboard.style.display = 'block';
            
            // Load dashboard data
            loadDashboardData();
        }
    }
    
    // ========== EVENT HANDLERS ==========
    function setupEventListeners() {
        // Login
        elements.loginBtn.addEventListener('click', login);
        elements.adminPassword.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                login();
            }
        });
        
        // Logout
        elements.logoutBtn.addEventListener('click', logout);
        
        // Search input
        elements.searchLicenses.addEventListener('input', function() {
            state.searchQuery = this.value;
            filterLicenses();
        });
        
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                state.currentFilter = this.dataset.filter;
                filterLicenses();
            });
        });
        
        // Duration options
        document.querySelectorAll('.duration-option').forEach(option => {
            option.addEventListener('click', function() {
                document.querySelectorAll('.duration-option').forEach(o => o.classList.remove('selected'));
                this.classList.add('selected');
                state.selectedDuration = parseInt(this.dataset.days);
            });
        });
        
        // Generate key button
        elements.generateKeyBtn.addEventListener('click', async function() {
            const email = elements.customerEmail.value.trim();
            const name = elements.customerName.value.trim();
            
            if (!email) {
                showNotification('Please enter customer email', 'error');
                return;
            }
            
            // Simple email validation
            if (!email.includes('@') || !email.includes('.')) {
                showNotification('Please enter a valid email address', 'error');
                return;
            }
            
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
            
            try {
                const result = await generateLicenseKey(email, name, state.selectedDuration);
                
                // Show generated key
                elements.generatedKey.textContent = result.key;
                elements.generatedKeySection.style.display = 'block';
                
                // Scroll to generated key
                elements.generatedKeySection.scrollIntoView({ behavior: 'smooth' });
                
                // Clear form
                elements.customerEmail.value = '';
                elements.customerName.value = '';
                
                // Refresh licenses list
                loadLicenses();
                
            } catch (error) {
                console.error('Key generation failed:', error);
            } finally {
                this.disabled = false;
                this.innerHTML = '<i class="fas fa-key"></i> Generate License Key';
            }
        });
        
        // Copy key button
        elements.copyKeyBtn.addEventListener('click', function() {
            const key = elements.generatedKey.textContent;
            copyToClipboard(key);
        });
        
        // Send email button
        elements.sendEmailBtn.addEventListener('click', async function() {
            const key = elements.generatedKey.textContent;
            
            if (!key || key === 'MONTH-SORV-XXXX-XXXX-XXXX-XXXX') {
                showNotification('No key generated yet', 'error');
                return;
            }
            
            showNotification('Email sending would be configured with your email service', 'info');
        });
        
        // Save to DB button
        elements.saveToDBBtn.addEventListener('click', function() {
            showNotification('Key is already saved to database when generated', 'info');
        });
        
        // Quick action cards
        elements.refreshData.addEventListener('click', function() {
            loadDashboardData();
        });
        
        elements.viewAllCustomers.addEventListener('click', function() {
            state.currentFilter = 'all';
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('[data-filter="all"]').classList.add('active');
            filterLicenses();
            showNotification('Showing all licenses', 'info');
        });
        
        elements.exportData.addEventListener('click', function() {
            exportToCSV();
        });
        
        elements.systemHealth.addEventListener('click', function() {
            showNotification('System health check would show server status', 'info');
        });
        
        // Deactivate modal buttons
        elements.confirmDeactivate.addEventListener('click', async function() {
            if (state.selectedLicense) {
                const success = await deactivateLicense(state.selectedLicense);
                if (success) {
                    showNotification('License deactivated successfully', 'success');
                }
                elements.deactivateModal.classList.remove('active');
                state.selectedLicense = null;
            }
        });
        
        elements.cancelDeactivate.addEventListener('click', function() {
            elements.deactivateModal.classList.remove('active');
            state.selectedLicense = null;
        });
        
        // Close modals when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', function(e) {
                if (e.target === this) {
                    hideModals();
                }
            });
        });
        
        // Close modal buttons
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', hideModals);
        });
    }
    
    // ========== HELPER FUNCTIONS ==========
    window.copyToClipboard = function(text) {
        navigator.clipboard.writeText(text)
            .then(() => showNotification('Copied to clipboard!', 'success'))
            .catch(() => showNotification('Failed to copy', 'error'));
    };
    
    function exportToCSV() {
        if (state.licenses.length === 0) {
            showNotification('No data to export', 'error');
            return;
        }
        
        const headers = ['License Key', 'Customer Email', 'Customer Name', 'Plan', 'Status', 'Created', 'Expires', 'Device ID', 'Validations'];
        
        const csvData = [
            headers.join(','),
            ...state.licenses.map(license => {
                const status = getLicenseStatus(license);
                return [
                    `"${license.licenseKey}"`,
                    `"${license.customerEmail}"`,
                    `"${license.customerName || ''}"`,
                    `"${CONFIG.LICENSE_TYPES[license.days] || license.plan || 'Monthly'}"`,
                    `"${status}"`,
                    `"${formatDate(license.createdAt)}"`,
                    `"${formatDate(license.expiresAt)}"`,
                    `"${license.deviceId || ''}"`,
                    `"${license.validationCount || 0}"`
                ].join(',');
            })
        ].join('\n');
        
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sorvide-licenses-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('Data exported to CSV', 'success');
    }
    
    // ========== INITIALIZATION ==========
    function init() {
        setupEventListeners();
        checkExistingSession();
        
        // Focus on password input if showing login
        if (elements.loginScreen.style.display !== 'none') {
            elements.adminPassword.focus();
        }
        
        console.log('✅ Admin Dashboard initialized');
    }
    
    // Start the admin dashboard
    init();
});