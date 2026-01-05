document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Loading Sorvide Admin Dashboard...');
    
    // ========== CONFIGURATION ==========
    const CONFIG = {
        BACKEND_API: 'https://sorvide-backend.onrender.com/api',
        ADMIN_TOKEN: 'SorvAdm!2024@Sec#Key',
        
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
        adminToken: '',
        licenseToDeactivate: null
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
        systemHealth: document.getElementById('systemHealth'),
        
        // Filters
        filterButtons: document.querySelectorAll('.filter-btn'),
        
        // Duration options
        durationOptions: document.querySelectorAll('.duration-option'),
        
        // Modal close buttons
        closeModalButtons: document.querySelectorAll('.close-modal')
    };
    
    // ========== UTILITY FUNCTIONS ==========
    function showNotification(message, type = 'success', duration = 3000) {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());
        
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
        }, duration);
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
    async function checkAdminAuth(token) {
        try {
            console.log('🔐 Checking admin auth...');
            
            const response = await fetch(`${CONFIG.BACKEND_API}/admin/check-auth`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
            });
            
            console.log('Auth response status:', response.status);
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.log('Auth endpoint not found, using local check');
                    if (token === CONFIG.ADMIN_TOKEN) {
                        return { success: true, message: 'Authentication successful (local)' };
                    }
                    return { success: false, error: 'Invalid admin password' };
                }
                
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Auth response data:', data);
            return data;
            
        } catch (error) {
            console.error('Auth check error:', error);
            if (token === CONFIG.ADMIN_TOKEN) {
                return { success: true, message: 'Authentication successful (local fallback)' };
            }
            return { 
                success: false, 
                error: 'Authentication failed. Please try again.' 
            };
        }
    }
    
    async function fetchWithAuth(url, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'x-admin-token': state.adminToken,
            ...options.headers
        };
        
        console.log(`🌐 Fetching: ${CONFIG.BACKEND_API}${url}`);
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(`${CONFIG.BACKEND_API}${url}`, {
                ...options,
                headers,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            console.log(`Response status: ${response.status} for ${url}`);
            
            if (!response.ok) {
                if (response.status === 401) {
                    showNotification('Session expired. Please login again.', 'error');
                    logout();
                    throw new Error('Unauthorized');
                }
                
                let errorMessage = `API Error: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    // Ignore JSON parsing error
                }
                
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            console.log(`Success response from ${url}:`, data);
            return data;
            
        } catch (error) {
            console.error('Fetch error:', error);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout. Please check your connection.');
            }
            
            if (error.message !== 'Unauthorized') {
                showNotification(`Network error: ${error.message}`, 'error');
            }
            
            throw error;
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
                loadSampleData();
                showNotification('Using sample data (backend unavailable)', 'warning');
            }
        }
    }
    
    function loadSampleData() {
        // Sample data for testing when backend is unavailable
        state.licenses = [
            {
                licenseKey: 'MONTH-SORV-ABC1-2345-6789-DEF0',
                customerEmail: 'test@example.com',
                customerName: 'Test User',
                plan: 'monthly',
                isActive: true,
                createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
                expiresAt: new Date(Date.now() + 86400000 * 20).toISOString(),
                deviceId: 'DEV-123456789',
                deviceName: 'Chrome Extension',
                lastValidated: new Date().toISOString(),
                validationCount: 15,
                days: 30
            }
        ];
        
        state.filteredLicenses = [...state.licenses];
        
        updateDashboardStatsFromLocal();
        renderLicenseTable();
        renderRecentActivity([
            {
                type: 'license_created',
                details: 'Manual license created for 30 days',
                timestamp: new Date().toISOString(),
                customerEmail: 'test@example.com'
            }
        ]);
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
            if (!error.message.includes('Unauthorized') && !state.licenses.length) {
                loadSampleData();
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
            renderRecentActivity([]);
        }
    }
    
    async function createLicense(email, name, days) {
        try {
            showNotification('Creating license...', 'info');
            
            const response = await fetchWithAuth('/admin/create-license', {
                method: 'POST',
                body: JSON.stringify({ 
                    email: email,
                    name: name,
                    days: days
                })
            });
            
            if (response.success) {
                showNotification('License created successfully!', 'success');
                
                // Show the generated key
                if (elements.generatedKey) {
                    elements.generatedKey.textContent = response.license.key;
                }
                if (elements.generatedKeySection) {
                    elements.generatedKeySection.style.display = 'block';
                }
                
                // Clear form
                if (elements.customerEmail) elements.customerEmail.value = '';
                if (elements.customerName) elements.customerName.value = '';
                
                // Reload licenses
                await loadLicenses();
                await loadRecentActivity();
                
                return response.license;
            } else {
                throw new Error(response.error || 'Failed to create license');
            }
        } catch (error) {
            console.error('Create license error:', error);
            showNotification(`Failed to create license: ${error.message}`, 'error');
            throw error;
        }
    }
    
    async function deactivateLicense(licenseKey) {
        try {
            showNotification('Deactivating license...', 'info');
            
            const response = await fetchWithAuth('/admin/deactivate-license', {
                method: 'POST',
                body: JSON.stringify({ licenseKey })
            });
            
            if (response.success) {
                showNotification('License deactivated successfully', 'success');
                
                // Reload data
                await loadLicenses();
                await loadRecentActivity();
                
                return true;
            } else {
                throw new Error(response.error || 'Failed to deactivate license');
            }
        } catch (error) {
            console.error('Deactivate license error:', error);
            showNotification(`Failed to deactivate license: ${error.message}`, 'error');
            throw error;
        }
    }
    
    async function showLicenseDetails(licenseKey) {
        try {
            const response = await fetchWithAuth(`/admin/license/${licenseKey}`);
            
            if (response.success) {
                const license = response.license;
                const modalContent = `
                    <div class="license-details">
                        <div class="detail-row">
                            <strong>License Key:</strong>
                            <code style="display: block; background: #f8f9fa; padding: 8px; border-radius: 4px; margin-top: 5px; font-family: monospace;">${license.key}</code>
                        </div>
                        
                        <div class="detail-row">
                            <strong>Customer:</strong>
                            <div>${license.customerName || 'N/A'} (${license.customerEmail})</div>
                        </div>
                        
                        <div class="detail-row">
                            <strong>Plan:</strong>
                            <span>${license.plan} (${license.days || 30} days)</span>
                        </div>
                        
                        <div class="detail-row">
                            <strong>Status:</strong>
                            ${getStatusBadge(license.isActive ? (license.daysLeft > 0 ? 'Active' : 'Expired') : 'Inactive')}
                            <span style="margin-left: 10px;">${license.daysLeft > 0 ? `${license.daysLeft} days left` : 'Expired'}</span>
                        </div>
                        
                        <div class="detail-row">
                            <strong>Created:</strong>
                            <span>${formatDate(license.createdAt)}</span>
                        </div>
                        
                        <div class="detail-row">
                            <strong>Expires:</strong>
                            <span>${formatDate(license.expiresAt)}</span>
                        </div>
                        
                        <div class="detail-row">
                            <strong>Device:</strong>
                            <span>${license.deviceId ? `${license.deviceName || 'Unknown'} (${license.deviceId.substring(0, 8)}...)` : 'Not activated'}</span>
                        </div>
                        
                        <div class="detail-row">
                            <strong>Last Validated:</strong>
                            <span>${license.lastValidated ? formatDate(license.lastValidated) : 'Never'}</span>
                        </div>
                        
                        <div class="detail-row">
                            <strong>Validations:</strong>
                            <span>${license.validationCount || 0}</span>
                        </div>
                        
                        ${license.stripeCustomerId ? `
                        <div class="detail-row">
                            <strong>Stripe Customer ID:</strong>
                            <code style="font-size: 12px;">${license.stripeCustomerId}</code>
                        </div>
                        ` : ''}
                        
                        ${license.stripeSubscriptionId ? `
                        <div class="detail-row">
                            <strong>Stripe Subscription ID:</strong>
                            <code style="font-size: 12px;">${license.stripeSubscriptionId}</code>
                        </div>
                        ` : ''}
                        
                        <div class="detail-row">
                            <strong>License Type:</strong>
                            <span>${license.isManual ? 'Manual Creation' : 'Stripe Purchase'}</span>
                        </div>
                    </div>
                    
                    <style>
                        .license-details {
                            display: grid;
                            gap: 15px;
                            padding: 10px 0;
                        }
                        .detail-row {
                            padding-bottom: 10px;
                            border-bottom: 1px solid #e2e8f0;
                        }
                        .detail-row:last-child {
                            border-bottom: none;
                        }
                        .detail-row strong {
                            display: block;
                            margin-bottom: 5px;
                            color: #4a5568;
                        }
                    </style>
                `;
                
                if (elements.licenseDetailsModal) {
                    const modalBody = elements.licenseDetailsModal.querySelector('.modal-body');
                    if (modalBody) {
                        modalBody.innerHTML = modalContent;
                    }
                    elements.licenseDetailsModal.classList.add('active');
                }
            } else {
                throw new Error(response.error || 'Failed to load license details');
            }
        } catch (error) {
            console.error('License details error:', error);
            showNotification(`Failed to load license details: ${error.message}`, 'error');
        }
    }
    
    // ========== UI UPDATE FUNCTIONS ==========
    function updateDashboardStats(stats) {
        if (elements.totalLicenses) elements.totalLicenses.textContent = stats.totalLicenses || 0;
        if (elements.activeLicenses) elements.activeLicenses.textContent = stats.activeLicenses || 0;
        if (elements.monthlyRevenue) elements.monthlyRevenue.textContent = `$${(stats.monthlyRevenue || 0).toFixed(2)}`;
        if (elements.recentActivityCount) elements.recentActivityCount.textContent = stats.recentActivity || 0;
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
        
        if (elements.totalLicenses) elements.totalLicenses.textContent = total;
        if (elements.activeLicenses) elements.activeLicenses.textContent = active;
        if (elements.monthlyRevenue) elements.monthlyRevenue.textContent = `$${revenue.toFixed(2)}`;
        if (elements.recentActivityCount) elements.recentActivityCount.textContent = '1';
    }
    
    function renderLicenseTable() {
        if (!elements.licenseTableBody) return;
        
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
                        <div class="license-key-display" title="${license.licenseKey}" 
                             onclick="window.copyToClipboard('${license.licenseKey}')">
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
        if (!elements.recentActivity) return;
        
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
            const icon = activity.type === 'license_created' ? 'fa-key' :
                        activity.type === 'license_deactivated' ? 'fa-power-off' :
                        activity.type === 'subscription_cancelled' ? 'fa-ban' :
                        activity.type === 'license_reactivated' ? 'fa-redo' : 'fa-check-circle';
            
            const title = activity.type === 'license_created' ? 'License Created' :
                         activity.type === 'license_deactivated' ? 'License Deactivated' :
                         activity.type === 'subscription_cancelled' ? 'Subscription Cancelled' :
                         activity.type === 'license_reactivated' ? 'License Reactivated' : 'Validation';
            
            html += `
                <div class="activity-item">
                    <div class="activity-icon ${activity.type}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">${title}</div>
                        <div class="activity-details">${truncateText(activity.details || 'No details', 40)}</div>
                        <div class="activity-time">${formatDate(activity.timestamp)}</div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    // ========== AUTHENTICATION FUNCTIONS ==========
    async function login() {
        const password = elements.adminPassword ? elements.adminPassword.value.trim() : '';
        
        if (!password) {
            showLoginError('Please enter the admin password');
            return;
        }
        
        // Disable button and show loading
        if (elements.loginBtn) {
            elements.loginBtn.disabled = true;
            elements.loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
        }
        
        try {
            console.log('Attempting login...');
            const result = await checkAdminAuth(password);
            
            if (result.success) {
                // Success
                state.isAuthenticated = true;
                state.adminToken = password;
                
                // Store with timestamp
                try {
                    sessionStorage.setItem('sorvide_admin_token', password);
                    sessionStorage.setItem('sorvide_admin_login_time', Date.now().toString());
                } catch (e) {
                    console.warn('Could not store in sessionStorage:', e);
                }
                
                // Show dashboard
                if (elements.loginScreen) {
                    elements.loginScreen.style.display = 'none';
                }
                if (elements.adminDashboard) {
                    elements.adminDashboard.style.display = 'block';
                }
                
                // Load dashboard data
                loadDashboardData();
                
                showNotification('Admin login successful!', 'success');
                
            } else {
                showLoginError(result.error || 'Invalid password');
            }
            
        } catch (error) {
            console.error('Login error:', error);
            showLoginError('Authentication error: ' + (error.message || 'Unknown error'));
        } finally {
            // Re-enable button
            if (elements.loginBtn) {
                elements.loginBtn.disabled = false;
                elements.loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Access Dashboard';
            }
        }
    }
    
    function showLoginError(message) {
        if (elements.loginError) {
            elements.loginError.textContent = message;
            elements.loginError.style.display = 'block';
            if (elements.adminPassword) {
                elements.adminPassword.focus();
            }
            
            setTimeout(() => {
                if (elements.loginError) {
                    elements.loginError.style.display = 'none';
                }
            }, 5000);
        } else {
            showNotification(message, 'error');
        }
    }
    
    function logout() {
        state.isAuthenticated = false;
        state.adminToken = '';
        
        try {
            sessionStorage.removeItem('sorvide_admin_token');
            sessionStorage.removeItem('sorvide_admin_login_time');
        } catch (e) {
            // Ignore
        }
        
        // Clear inputs
        if (elements.adminPassword) {
            elements.adminPassword.value = '';
        }
        
        // Show login screen
        if (elements.loginScreen) {
            elements.loginScreen.style.display = 'flex';
        }
        if (elements.adminDashboard) {
            elements.adminDashboard.style.display = 'none';
        }
        
        // Reset dashboard state
        state.licenses = [];
        state.filteredLicenses = [];
        
        showNotification('Logged out successfully', 'info');
    }
    
    function checkExistingSession() {
        try {
            const savedToken = sessionStorage.getItem('sorvide_admin_token');
            const loginTimestamp = sessionStorage.getItem('sorvide_admin_login_time');
            const now = Date.now();
            
            if (savedToken && loginTimestamp) {
                const hoursSinceLogin = (now - parseInt(loginTimestamp)) / (1000 * 60 * 60);
                
                // Auto-logout after 8 hours even if tab is open
                if (hoursSinceLogin > 8) {
                    logout();
                    return;
                }
            }
            
            if (savedToken && savedToken === CONFIG.ADMIN_TOKEN) {
                state.adminToken = savedToken;
                state.isAuthenticated = true;
                
                if (elements.loginScreen) {
                    elements.loginScreen.style.display = 'none';
                }
                if (elements.adminDashboard) {
                    elements.adminDashboard.style.display = 'block';
                }
                
                loadDashboardData();
            }
        } catch (e) {
            console.warn('Session check failed:', e);
        }
    }
    
    // ========== MODAL FUNCTIONS ==========
    function showDeactivateModal(licenseKey) {
        state.licenseToDeactivate = licenseKey;
        if (elements.deactivateModal) {
            elements.deactivateModal.classList.add('active');
        }
    }
    
    function closeModals() {
        if (elements.licenseDetailsModal) {
            elements.licenseDetailsModal.classList.remove('active');
        }
        if (elements.deactivateModal) {
            elements.deactivateModal.classList.remove('active');
        }
        state.licenseToDeactivate = null;
    }
    
    // ========== EVENT HANDLERS ==========
    function setupEventListeners() {
        // Login
        if (elements.loginBtn) {
            elements.loginBtn.addEventListener('click', login);
        }
        
        if (elements.adminPassword) {
            elements.adminPassword.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    login();
                }
            });
        }
        
        // Logout
        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', logout);
        }
        
        // Search
        if (elements.searchLicenses) {
            elements.searchLicenses.addEventListener('input', function(e) {
                state.searchQuery = e.target.value;
                filterLicenses();
            });
        }
        
        // Filters
        if (elements.filterButtons) {
            elements.filterButtons.forEach(btn => {
                btn.addEventListener('click', function() {
                    // Remove active class from all buttons
                    elements.filterButtons.forEach(b => b.classList.remove('active'));
                    // Add active class to clicked button
                    this.classList.add('active');
                    state.currentFilter = this.dataset.filter;
                    filterLicenses();
                });
            });
        }
        
        // Duration options
        if (elements.durationOptions) {
            elements.durationOptions.forEach(option => {
                option.addEventListener('click', function() {
                    // Remove selected class from all options
                    elements.durationOptions.forEach(o => o.classList.remove('selected'));
                    // Add selected class to clicked option
                    this.classList.add('selected');
                    state.selectedDuration = parseInt(this.dataset.days);
                });
            });
        }
        
        // Generate license key
        if (elements.generateKeyBtn) {
            elements.generateKeyBtn.addEventListener('click', async function() {
                const email = elements.customerEmail ? elements.customerEmail.value.trim() : '';
                const name = elements.customerName ? elements.customerName.value.trim() : '';
                
                if (!email) {
                    showNotification('Please enter customer email', 'error');
                    return;
                }
                
                // Validate email
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    showNotification('Please enter a valid email address', 'error');
                    return;
                }
                
                try {
                    await createLicense(email, name, state.selectedDuration);
                } catch (error) {
                    // Error already shown in createLicense function
                }
            });
        }
        
        // Copy key button
        if (elements.copyKeyBtn) {
            elements.copyKeyBtn.addEventListener('click', function() {
                const keyText = elements.generatedKey ? elements.generatedKey.textContent : '';
                if (keyText) {
                    navigator.clipboard.writeText(keyText)
                        .then(() => showNotification('License key copied to clipboard!', 'success'))
                        .catch(() => showNotification('Failed to copy key', 'error'));
                }
            });
        }
        
        // Send email button
        if (elements.sendEmailBtn) {
            elements.sendEmailBtn.addEventListener('click', function() {
                showNotification('Email sending would be implemented here', 'info');
                // In a real implementation, you would call an API endpoint to send the email
            });
        }
        
        // Save to DB button
        if (elements.saveToDBBtn) {
            elements.saveToDBBtn.addEventListener('click', function() {
                showNotification('License already saved to database', 'info');
            });
        }
        
        // Deactivate license confirmation
        if (elements.confirmDeactivate) {
            elements.confirmDeactivate.addEventListener('click', async function() {
                if (state.licenseToDeactivate) {
                    try {
                        await deactivateLicense(state.licenseToDeactivate);
                        closeModals();
                    } catch (error) {
                        // Error already shown in deactivateLicense function
                    }
                }
            });
        }
        
        // Cancel deactivation
        if (elements.cancelDeactivate) {
            elements.cancelDeactivate.addEventListener('click', function() {
                closeModals();
            });
        }
        
        // Close modal buttons
        if (elements.closeModalButtons) {
            elements.closeModalButtons.forEach(btn => {
                btn.addEventListener('click', function() {
                    closeModals();
                });
            });
        }
        
        // Close modals on outside click
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal')) {
                closeModals();
            }
        });
        
        // Quick actions
        if (elements.refreshData) {
            elements.refreshData.addEventListener('click', function() {
                loadDashboardData();
            });
        }
        
        if (elements.viewAllCustomers) {
            elements.viewAllCustomers.addEventListener('click', function() {
                state.currentFilter = 'all';
                state.searchQuery = '';
                if (elements.searchLicenses) {
                    elements.searchLicenses.value = '';
                }
                // Update filter buttons
                elements.filterButtons.forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.filter === 'all') {
                        btn.classList.add('active');
                    }
                });
                filterLicenses();
                showNotification('Showing all customers', 'info');
            });
        }
        
        if (elements.exportData) {
            elements.exportData.addEventListener('click', function() {
                showNotification('Export feature would be implemented here', 'info');
            });
        }
        
        if (elements.systemHealth) {
            elements.systemHealth.addEventListener('click', async function() {
                try {
                    const response = await fetch(`${CONFIG.BACKEND_API}/health`);
                    if (response.ok) {
                        const data = await response.json();
                        showNotification(`System is ${data.status}. MongoDB: ${data.mongodb}`, 'success');
                    } else {
                        showNotification('Backend is not responding', 'error');
                    }
                } catch (error) {
                    showNotification('Cannot connect to backend', 'error');
                }
            });
        }
        
        // Global copy function
        window.copyToClipboard = function(text) {
            navigator.clipboard.writeText(text)
                .then(() => showNotification('Copied to clipboard!', 'success'))
                .catch(() => showNotification('Failed to copy', 'error'));
        };
    }
    
    function filterLicenses() {
        if (state.licenses.length === 0) return;
        
        let filtered = [...state.licenses];
        
        // Apply filter
        if (state.currentFilter !== 'all') {
            filtered = filtered.filter(license => {
                const status = getLicenseStatus(license);
                const plan = license.plan || 'monthly';
                const days = license.days || 30;
                
                switch(state.currentFilter) {
                    case 'active':
                        return status === 'Active';
                    case 'inactive':
                        return status === 'Inactive';
                    case 'expired':
                        return status === 'Expired';
                    case 'monthly':
                        return plan === 'monthly' || days === 30;
                    case 'trial':
                        return days === 3 || days === 7;
                    case 'yearly':
                        return days === 365;
                    default:
                        return true;
                }
            });
        }
        
        // Apply search
        if (state.searchQuery) {
            const query = state.searchQuery.toLowerCase();
            filtered = filtered.filter(license => 
                (license.licenseKey && license.licenseKey.toLowerCase().includes(query)) ||
                (license.customerEmail && license.customerEmail.toLowerCase().includes(query)) ||
                (license.customerName && license.customerName.toLowerCase().includes(query))
            );
        }
        
        state.filteredLicenses = filtered;
        renderLicenseTable();
    }
    
    // ========== INITIALIZATION ==========
    function init() {
        console.log('Initializing admin dashboard...');
        
        // First, check if we have DOM elements
        if (!elements.loginScreen && !elements.adminDashboard) {
            console.error('DOM elements not found. Make sure the HTML is loaded correctly.');
            showNotification('Error: Page not loaded correctly. Please refresh.', 'error');
            return;
        }
        
        // Setup event listeners
        setupEventListeners();
        
        // Check for existing session
        checkExistingSession();
        
        // Focus on password input if showing login
        if (elements.adminPassword && elements.loginScreen.style.display !== 'none') {
            elements.adminPassword.focus();
        }
        
        console.log('✅ Admin Dashboard initialized');
    }
    
    // Start the admin dashboard
    init();
});