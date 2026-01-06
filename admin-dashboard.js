// admin-dashboard.js - Updated with activation status, improved layout, and lifetime revenue

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Loading Sorvide Admin Dashboard...');
    
    // ========== CONFIGURATION ==========
    const CONFIG = {
        BACKEND_API: 'https://sorvide-backend.onrender.com/api',
        ADMIN_TOKEN: 'SorvAdm!2024@Sec#Key',
        
        // Revenue calculation
        MONTHLY_PRICE: 9.99,
        YEARLY_PRICE: 99.99
    };
    
    // ========== STATE ==========
    let state = {
        isAuthenticated: false,
        licenses: [],
        filteredLicenses: [],
        activities: [],
        filteredActivities: [],
        selectedLicense: null,
        selectedDuration: 30,
        searchQuery: '',
        currentFilter: 'all',
        adminToken: '',
        licenseToDeactivate: null,
        licenseToDelete: null,
        isStripeLicenseToDelete: false,
        currentLicensePage: 1,
        currentActivityPage: 1,
        licensesPerPage: 10,
        activitiesPerPage: 5,
        totalLicensePages: 1,
        totalActivityPages: 1,
        monthlyRevenue: 0,
        lifetimeRevenue: 0, // CHANGED: yearlyRevenue -> lifetimeRevenue
        totalRevenue: 0
    };
    
    // ========== DOM ELEMENTS ==========
    const elements = {};
    
    // Initialize DOM elements
    function initDOMElements() {
        elements.loginScreen = document.getElementById('loginScreen');
        elements.adminPassword = document.getElementById('adminPassword');
        elements.loginBtn = document.getElementById('loginBtn');
        elements.loginError = document.getElementById('loginError');
        elements.adminDashboard = document.getElementById('adminDashboard');
        elements.logoutBtn = document.getElementById('logoutBtn');
        elements.totalLicenses = document.getElementById('totalLicenses');
        elements.activeLicenses = document.getElementById('activeLicenses');
        elements.monthlyRevenue = document.getElementById('monthlyRevenue');
        elements.lifetimeRevenue = document.getElementById('yearlyRevenue'); // Using existing element
        elements.searchLicenses = document.getElementById('searchLicenses');
        elements.licenseTableBody = document.getElementById('licenseTableBody');
        elements.customerEmail = document.getElementById('customerEmail');
        elements.customerName = document.getElementById('customerName');
        elements.generateKeyBtn = document.getElementById('generateKeyBtn');
        elements.generatedKeySection = document.getElementById('generatedKeySection');
        elements.generatedKey = document.getElementById('generatedKey');
        elements.copyKeyBtn = document.getElementById('copyKeyBtn');
        elements.sendEmailBtn = document.getElementById('sendEmailBtn');
        elements.saveToDBBtn = document.getElementById('saveToDBBtn');
        elements.licenseDetailsModal = document.getElementById('licenseDetailsModal');
        elements.deactivateModal = document.getElementById('deactivateModal');
        elements.deleteModal = document.getElementById('deleteModal');
        elements.confirmDeactivate = document.getElementById('confirmDeactivate');
        elements.cancelDeactivate = document.getElementById('cancelDeactivate');
        elements.recentActivity = document.getElementById('recentActivity');
        elements.refreshData = document.getElementById('refreshData');
        elements.systemHealth = document.getElementById('systemHealth');
        elements.paginationContainer = document.getElementById('paginationContainer');
        elements.activityPaginationContainer = document.getElementById('activityPaginationContainer');
        elements.clearAllActivityBtn = document.getElementById('clearAllActivityBtn');
        
        console.log('DOM elements initialized');
    }
    
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
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            }) + ', ' + date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }).replace(':00', '').replace(' AM', 'am').replace(' PM', 'pm');
        } catch (e) {
            return 'Invalid date';
        }
    }
    
    function formatDaysLeft(license) {
        if (!license.isActive) return '';
        
        try {
            const expiry = new Date(license.expiresAt);
            const now = new Date();
            const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
            
            if (daysLeft <= 0) return 'Expired';
            if (daysLeft === 1) return '1 day left';
            return `${daysLeft} days left`;
        } catch (e) {
            return '';
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
    
    function getActivationStatus(license) {
        if (!license.isActive) return 'Inactive';
        return license.deviceId && license.deviceId.trim() !== '' ? 'Activated' : 'Not Activated';
    }
    
    function getStatusBadge(status) {
        const badges = {
            'Active': 'status-active',
            'Inactive': 'status-inactive',
            'Expired': 'status-expired',
            'Activated': 'status-activated',
            'Not Activated': 'status-not-activated',
            'Unknown': 'status-inactive'
        };
        
        return `<span class="status-badge ${badges[status] || 'status-inactive'}">${status}</span>`;
    }
    
    function truncateText(text, maxLength = 20) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
    
    // ========== REVENUE CALCULATIONS ==========
    function calculateLifetimeRevenue() {
        let totalRevenue = 0;
        const now = new Date();
        
        state.licenses.forEach(license => {
            if (license.plan === 'monthly' || license.days === 30) {
                const createdAt = new Date(license.createdAt);
                const expiresAt = new Date(license.expiresAt);
                
                // Calculate total months active (including partial months)
                let monthsActive = 0;
                
                if (license.isActive && expiresAt > now) {
                    // Still active, calculate from creation to now
                    monthsActive = (now - createdAt) / (1000 * 60 * 60 * 24 * 30.44);
                } else if (license.isActive && expiresAt <= now) {
                    // Expired but still marked as active
                    monthsActive = (expiresAt - createdAt) / (1000 * 60 * 60 * 24 * 30.44);
                } else if (!license.isActive) {
                    // Inactive, calculate from creation to expiration
                    monthsActive = (expiresAt - createdAt) / (1000 * 60 * 60 * 24 * 30.44);
                }
                
                // Add revenue for each month (or partial month)
                if (monthsActive > 0) {
                    totalRevenue += monthsActive * CONFIG.MONTHLY_PRICE;
                }
            }
        });
        
        state.lifetimeRevenue = parseFloat(totalRevenue.toFixed(2));
        
        // Also calculate total monthly revenue for current active licenses
        const activeMonthlyLicenses = state.licenses.filter(l => 
            l.isActive && 
            (l.plan === 'monthly' || l.days === 30) &&
            new Date(l.expiresAt) > new Date()
        ).length;
        
        state.monthlyRevenue = activeMonthlyLicenses * CONFIG.MONTHLY_PRICE;
        
        // Update the display
        updateRevenueDisplay();
    }
    
    function updateRevenueDisplay() {
        if (elements.monthlyRevenue) {
            elements.monthlyRevenue.textContent = `$${state.monthlyRevenue.toFixed(2)}`;
        }
        
        if (elements.lifetimeRevenue) {
            elements.lifetimeRevenue.textContent = `$${state.lifetimeRevenue.toFixed(2)}`;
            // Update the label if needed
            const label = elements.lifetimeRevenue.closest('.stat-box')?.querySelector('.stat-label');
            if (label) {
                label.textContent = 'Lifetime Revenue';
            }
        }
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
            
            // Load licenses
            await loadLicenses();
            
            // Load recent activity
            await loadRecentActivity();
            
            // Calculate revenue from loaded licenses
            calculateLifetimeRevenue();
            
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
        // Sample data for testing
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
                days: 30,
                isManual: true,
                stripeSubscriptionId: null
            }
        ];
        
        // Sample activities
        state.activities = [
            {
                type: 'license_created',
                details: 'Manual license created for 30 days',
                timestamp: new Date().toISOString(),
                customerEmail: 'test@example.com'
            }
        ];
        
        state.filteredLicenses = [...state.licenses];
        state.filteredActivities = [...state.activities];
        
        // Calculate revenue from sample data
        calculateLifetimeRevenue();
        
        // Update dashboard stats
        if (elements.totalLicenses) elements.totalLicenses.textContent = state.licenses.length.toLocaleString();
        
        const activeCount = state.licenses.filter(l => {
            if (!l.isActive) return false;
            try {
                return new Date(l.expiresAt) > new Date();
            } catch (e) {
                return false;
            }
        }).length;
        
        if (elements.activeLicenses) elements.activeLicenses.textContent = activeCount.toLocaleString();
        
        renderLicenseTable();
        renderLicensePagination();
        renderRecentActivity();
        renderActivityPagination();
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
                
                // Update total licenses count
                if (elements.totalLicenses) {
                    elements.totalLicenses.textContent = state.licenses.length.toLocaleString();
                }
                
                // Update active licenses count
                const activeCount = state.licenses.filter(l => {
                    if (!l.isActive) return false;
                    try {
                        return new Date(l.expiresAt) > new Date();
                    } catch (e) {
                        return false;
                    }
                }).length;
                
                if (elements.activeLicenses) {
                    elements.activeLicenses.textContent = activeCount.toLocaleString();
                }
                
                // Calculate total pages
                state.totalLicensePages = Math.ceil(state.filteredLicenses.length / state.licensesPerPage);
                if (state.totalLicensePages === 0) state.totalLicensePages = 1;
                
                // Reset to page 1 if current page is out of bounds
                if (state.currentLicensePage > state.totalLicensePages) {
                    state.currentLicensePage = 1;
                }
                
                renderLicenseTable();
                renderLicensePagination();
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
                state.activities = data.activities || [];
                state.filteredActivities = [...state.activities];
                
                // Calculate total pages
                state.totalActivityPages = Math.ceil(state.filteredActivities.length / state.activitiesPerPage);
                if (state.totalActivityPages === 0) state.totalActivityPages = 1;
                
                // Reset to page 1 if current page is out of bounds
                if (state.currentActivityPage > state.totalActivityPages) {
                    state.currentActivityPage = 1;
                }
                
                renderRecentActivity();
                renderActivityPagination();
            }
        } catch (error) {
            console.error('Activity load error:', error);
            // Use sample activities
            state.activities = [];
            state.filteredActivities = [];
            renderRecentActivity();
            renderActivityPagination();
        }
    }
    
    async function clearAllActivity() {
        try {
            showNotification('Clearing all activity...', 'info');
            
            const response = await fetchWithAuth('/admin/activity', {
                method: 'DELETE'
            });
            
            if (response.success) {
                state.activities = [];
                state.filteredActivities = [];
                state.currentActivityPage = 1;
                state.totalActivityPages = 1;
                
                renderRecentActivity();
                renderActivityPagination();
                
                showNotification('All activity cleared successfully', 'success');
                
            } else {
                throw new Error(response.error || 'Failed to clear activity');
            }
            
        } catch (error) {
            console.error('Clear activity error:', error);
            showNotification(`Failed to clear activity: ${error.message}`, 'error');
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
                showNotification(`License created successfully for ${days} days!`, 'success');
                
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
                
                // Reload licenses and activity
                await loadLicenses();
                await loadRecentActivity();
                
                // Recalculate revenue
                calculateLifetimeRevenue();
                
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
    
    async function sendLicenseEmail(licenseKey, customerEmail, customerName) {
        try {
            showNotification('Sending license email...', 'info');
            
            const response = await fetchWithAuth('/admin/send-license-email', {
                method: 'POST',
                body: JSON.stringify({ 
                    licenseKey: licenseKey,
                    customerEmail: customerEmail,
                    customerName: customerName
                })
            });
            
            if (response.success) {
                showNotification('License email sent successfully!', 'success');
                return true;
            } else {
                throw new Error(response.error || 'Failed to send email');
            }
        } catch (error) {
            console.error('Send email error:', error);
            showNotification(`Failed to send email: ${error.message}`, 'error');
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
                
                // Recalculate revenue
                calculateLifetimeRevenue();
                
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
    
    async function deleteLicense(licenseKey) {
        try {
            showNotification('Deleting license...', 'info');
            
            const response = await fetchWithAuth(`/admin/license/${licenseKey}`, {
                method: 'DELETE'
            });
            
            if (response.success) {
                showNotification('License deleted successfully', 'success');
                
                // Reload data
                await loadLicenses();
                await loadRecentActivity();
                
                // Recalculate revenue
                calculateLifetimeRevenue();
                
                return true;
            } else {
                throw new Error(response.error || 'Failed to delete license');
            }
        } catch (error) {
            console.error('Delete license error:', error);
            
            // If DELETE endpoint doesn't exist yet, simulate deletion locally
            const licenseIndex = state.licenses.findIndex(l => l.licenseKey === licenseKey);
            if (licenseIndex !== -1) {
                state.licenses.splice(licenseIndex, 1);
                state.filteredLicenses = state.licenses.filter(l => l.licenseKey !== licenseKey);
                
                // Recalculate pages
                state.totalLicensePages = Math.ceil(state.filteredLicenses.length / state.licensesPerPage);
                if (state.totalLicensePages === 0) state.totalLicensePages = 1;
                if (state.currentLicensePage > state.totalLicensePages) state.currentLicensePage = 1;
                
                renderLicenseTable();
                renderLicensePagination();
                
                // Recalculate revenue
                calculateLifetimeRevenue();
                
                showNotification('License removed from local view (backend delete endpoint needed)', 'warning');
                return true;
            }
            
            showNotification(`Failed to delete license: ${error.message}`, 'error');
            throw error;
        }
    }
    
    async function showLicenseDetails(licenseKey) {
        try {
            const response = await fetchWithAuth(`/admin/license/${licenseKey}`);
            
            if (response.success) {
                const license = response.license;
                
                // UPDATED: Enhanced layout with activation status and better single-line display
                const modalContent = `
                    <div class="license-details">
                        <!-- License Information - Single Line -->
                        <div class="detail-section">
                            <h4><i class="fas fa-key"></i> License Information</h4>
                            <div class="detail-grid single-line">
                                <div class="detail-item">
                                    <label>License Key</label>
                                    <div class="detail-value license-key-value full-width" title="${license.key}">
                                        ${license.key}
                                    </div>
                                </div>
                                <div class="detail-item">
                                    <label>Status</label>
                                    <div class="detail-value">${getStatusBadge(license.isActive ? (license.daysLeft > 0 ? 'Active' : 'Expired') : 'Inactive')}</div>
                                </div>
                                <div class="detail-item">
                                    <label>Activation</label>
                                    <div class="detail-value">${getStatusBadge(license.deviceId && license.deviceId.trim() !== '' ? 'Activated' : 'Not Activated')}</div>
                                </div>
                                <div class="detail-item">
                                    <label>Plan Type</label>
                                    <div class="detail-value">${license.plan} (${license.days || 30} days)</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Customer Details - Double Line -->
                        <div class="detail-section">
                            <h4><i class="fas fa-user"></i> Customer Details</h4>
                            <div class="detail-grid double-line">
                                <div class="detail-item">
                                    <label>Customer Name</label>
                                    <div class="detail-value">${license.customerName || 'Not specified'}</div>
                                </div>
                                <div class="detail-item">
                                    <label>Email Address</label>
                                    <div class="detail-value">${license.customerEmail}</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Dates & Times - Single Line -->
                        <div class="detail-section">
                            <h4><i class="fas fa-calendar"></i> Dates & Times</h4>
                            <div class="detail-grid single-line">
                                <div class="detail-item">
                                    <label>Created On</label>
                                    <div class="detail-value">${formatDate(license.createdAt)}</div>
                                </div>
                                <div class="detail-item">
                                    <label>Expires On</label>
                                    <div class="detail-value">${formatDate(license.expiresAt)}</div>
                                </div>
                                ${license.daysLeft > 0 && license.isActive ? `
                                <div class="detail-item">
                                    <label>Days Remaining</label>
                                    <div class="detail-value status-active">${license.daysLeft} days</div>
                                </div>` : ''}
                            </div>
                        </div>
                        
                        ${license.deviceId || license.validationCount > 0 ? `
                        <!-- Usage Statistics - Single Line -->
                        <div class="detail-section">
                            <h4><i class="fas fa-chart-bar"></i> Usage Statistics</h4>
                            <div class="detail-grid single-line">
                                ${license.deviceId ? `
                                <div class="detail-item">
                                    <label>Device</label>
                                    <div class="detail-value">${license.deviceName || 'Chrome Extension'}</div>
                                </div>` : ''}
                                <div class="detail-item">
                                    <label>Validations</label>
                                    <div class="detail-value">${license.validationCount || 0} times</div>
                                </div>
                                ${license.lastValidated ? `
                                <div class="detail-item">
                                    <label>Last Validated</label>
                                    <div class="detail-value">${formatDate(license.lastValidated)}</div>
                                </div>` : ''}
                            </div>
                        </div>` : ''}
                        
                        ${license.stripeCustomerId || license.stripeSubscriptionId ? `
                        <!-- Payment Information - Single Line -->
                        <div class="detail-section">
                            <h4><i class="fas fa-credit-card"></i> Payment Information</h4>
                            <div class="detail-grid single-line">
                                ${license.stripeCustomerId ? `
                                <div class="detail-item">
                                    <label>Customer ID</label>
                                    <div class="detail-value small-text" title="${license.stripeCustomerId}">
                                        ${truncateText(license.stripeCustomerId, 25)}
                                    </div>
                                </div>` : ''}
                                ${license.stripeSubscriptionId ? `
                                <div class="detail-item">
                                    <label>Subscription ID</label>
                                    <div class="detail-value small-text" title="${license.stripeSubscriptionId}">
                                        ${truncateText(license.stripeSubscriptionId, 25)}
                                    </div>
                                </div>` : ''}
                                <div class="detail-item">
                                    <label>License Type</label>
                                    <div class="detail-value">${license.isManual ? 'Manual Creation' : 'Stripe Purchase'}</div>
                                </div>
                            </div>
                        </div>` : ''}
                    </div>
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
    function renderLicenseTable() {
        if (!elements.licenseTableBody) return;
        
        const tableBody = elements.licenseTableBody;
        
        if (state.filteredLicenses.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        <i class="fas fa-inbox" style="font-size: 32px; margin-bottom: 10px; display: block; opacity: 0.5;"></i>
                        No licenses found
                        ${state.searchQuery ? ` for "${state.searchQuery}"` : ''}
                    </td>
                </tr>
            `;
            return;
        }
        
        // Calculate pagination
        const startIndex = (state.currentLicensePage - 1) * state.licensesPerPage;
        const endIndex = startIndex + state.licensesPerPage;
        const currentLicenses = state.filteredLicenses.slice(startIndex, endIndex);
        
        let html = '';
        currentLicenses.forEach(license => {
            const status = getLicenseStatus(license);
            const activationStatus = getActivationStatus(license);
            const daysLeft = formatDaysLeft(license);
            const isStripeLicense = license.stripeSubscriptionId && !license.isManual;
            
            // Determine delete button color
            let deleteBtnClass = 'btn-stripe-delete';
            let deleteBtnTitle = 'Delete Stripe License';
            
            if (license.isManual) {
                deleteBtnClass = 'btn-manual-delete';
                deleteBtnTitle = 'Delete Manual License';
            }
            
            html += `
                <tr>
                    <td>
                        <div class="license-key-display single-line" title="${license.licenseKey}" 
                             onclick="window.copyToClipboard('${license.licenseKey}')">
                            ${truncateText(license.licenseKey, 24)}
                        </div>
                    </td>
                    <td>
                        <div class="customer-cell">
                            <div class="customer-name">${truncateText(license.customerName || 'No name', 18)}</div>
                            <div class="customer-email">${truncateText(license.customerEmail, 22)}</div>
                        </div>
                    </td>
                    <td><span class="plan-badge">${isStripeLicense ? 'Stripe' : 'Manual'}</span></td>
                    <td>${getStatusBadge(status)}</td>
                    <td>${getStatusBadge(activationStatus)}</td>
                    <td>
                        <div class="expiry-cell single-line">${formatDate(license.expiresAt)}</div>
                        ${daysLeft ? `<div class="days-left ${daysLeft.includes('Expired') ? 'expired' : 'active'}">
                            ${daysLeft}
                        </div>` : ''}
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
                            <button class="btn ${deleteBtnClass} btn-small delete-license" data-key="${license.licenseKey}" title="${deleteBtnTitle}">
                                <i class="fas fa-trash"></i>
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
        
        document.querySelectorAll('.delete-license').forEach(btn => {
            btn.addEventListener('click', function() {
                const licenseKey = this.dataset.key;
                const license = state.licenses.find(l => l.licenseKey === licenseKey);
                const isStripeLicense = license?.stripeSubscriptionId && !license?.isManual;
                showDeleteModal(licenseKey, isStripeLicense);
            });
        });
    }
    
    function renderLicensePagination() {
        if (!elements.paginationContainer) return;
        
        if (state.filteredLicenses.length <= state.licensesPerPage) {
            elements.paginationContainer.innerHTML = '';
            return;
        }
        
        let html = `
            <div class="pagination">
                <button class="pagination-btn ${state.currentLicensePage === 1 ? 'disabled' : ''}" 
                        ${state.currentLicensePage === 1 ? 'disabled' : ''} 
                        id="prevLicensePage">
                    <i class="fas fa-chevron-left"></i> Previous
                </button>
                
                <div class="page-numbers">
        `;
        
        // Show page numbers
        const maxPagesToShow = 5;
        let startPage = Math.max(1, state.currentLicensePage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(state.totalLicensePages, startPage + maxPagesToShow - 1);
        
        // Adjust start page if we're near the end
        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
        
        // First page
        if (startPage > 1) {
            html += `<button class="page-number ${state.currentLicensePage === 1 ? 'active' : ''}" data-page="1">1</button>`;
            if (startPage > 2) html += `<span class="page-dots">...</span>`;
        }
        
        // Page numbers
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="page-number ${state.currentLicensePage === i ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        
        // Last page
        if (endPage < state.totalLicensePages) {
            if (endPage < state.totalLicensePages - 1) html += `<span class="page-dots">...</span>`;
            html += `<button class="page-number ${state.currentLicensePage === state.totalLicensePages ? 'active' : ''}" data-page="${state.totalLicensePages}">${state.totalLicensePages}</button>`;
        }
        
        html += `
                </div>
                
                <button class="pagination-btn ${state.currentLicensePage === state.totalLicensePages ? 'disabled' : ''}" 
                        ${state.currentLicensePage === state.totalLicensePages ? 'disabled' : ''} 
                        id="nextLicensePage">
                    Next <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
        
        elements.paginationContainer.innerHTML = html;
        
        // Add event listeners
        document.getElementById('prevLicensePage')?.addEventListener('click', () => {
            if (state.currentLicensePage > 1) {
                state.currentLicensePage--;
                renderLicenseTable();
                renderLicensePagination();
            }
        });
        
        document.getElementById('nextLicensePage')?.addEventListener('click', () => {
            if (state.currentLicensePage < state.totalLicensePages) {
                state.currentLicensePage++;
                renderLicenseTable();
                renderLicensePagination();
            }
        });
        
        document.querySelectorAll('.page-number').forEach(btn => {
            btn.addEventListener('click', function() {
                const page = parseInt(this.dataset.page);
                if (page !== state.currentLicensePage) {
                    state.currentLicensePage = page;
                    renderLicenseTable();
                    renderLicensePagination();
                }
            });
        });
    }
    
    function renderRecentActivity() {
        if (!elements.recentActivity) return;
        
        const container = elements.recentActivity;
        
        if (state.filteredActivities.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <i class="fas fa-history" style="font-size: 32px; margin-bottom: 10px; opacity: 0.5;"></i>
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }
        
        // Calculate pagination
        const startIndex = (state.currentActivityPage - 1) * state.activitiesPerPage;
        const endIndex = startIndex + state.activitiesPerPage;
        const currentActivities = state.filteredActivities.slice(startIndex, endIndex);
        
        let html = '';
        currentActivities.forEach(activity => {
            const icon = activity.type === 'license_created' ? 'fa-key' :
                        activity.type === 'license_deactivated' ? 'fa-power-off' :
                        activity.type === 'subscription_cancelled' ? 'fa-ban' :
                        activity.type === 'license_reactivated' ? 'fa-redo' :
                        activity.type === 'license_deleted' ? 'fa-trash' :
                        activity.type === 'email_sent' ? 'fa-envelope' : 'fa-check-circle';
            
            const title = activity.type === 'license_created' ? 'License Created' :
                         activity.type === 'license_deactivated' ? 'License Deactivated' :
                         activity.type === 'subscription_cancelled' ? 'Subscription Cancelled' :
                         activity.type === 'license_reactivated' ? 'License Reactivated' :
                         activity.type === 'license_deleted' ? 'License Deleted' :
                         activity.type === 'email_sent' ? 'Email Sent' : 'Validation';
            
            html += `
                <div class="activity-item">
                    <div class="activity-icon ${activity.type}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">${title}</div>
                        <div class="activity-details">${truncateText(activity.details || 'No details', 50)}</div>
                        <div class="activity-time">${formatDate(activity.timestamp)}</div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    function renderActivityPagination() {
        if (!elements.activityPaginationContainer) return;
        
        if (state.filteredActivities.length <= state.activitiesPerPage) {
            elements.activityPaginationContainer.innerHTML = '';
            return;
        }
        
        let html = `
            <div class="activity-pagination">
                <button class="pagination-btn ${state.currentActivityPage === 1 ? 'disabled' : ''}" 
                        ${state.currentActivityPage === 1 ? 'disabled' : ''} 
                        id="prevActivityPage">
                    <i class="fas fa-chevron-left"></i>
                </button>
                
                <div class="activity-page-info">
                    Page ${state.currentActivityPage} of ${state.totalActivityPages}
                </div>
                
                <button class="pagination-btn ${state.currentActivityPage === state.totalActivityPages ? 'disabled' : ''}" 
                        ${state.currentActivityPage === state.totalActivityPages ? 'disabled' : ''} 
                        id="nextActivityPage">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
        
        elements.activityPaginationContainer.innerHTML = html;
        
        // Add event listeners
        document.getElementById('prevActivityPage')?.addEventListener('click', () => {
            if (state.currentActivityPage > 1) {
                state.currentActivityPage--;
                renderRecentActivity();
                renderActivityPagination();
            }
        });
        
        document.getElementById('nextActivityPage')?.addEventListener('click', () => {
            if (state.currentActivityPage < state.totalActivityPages) {
                state.currentActivityPage++;
                renderRecentActivity();
                renderActivityPagination();
            }
        });
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
        state.activities = [];
        state.filteredActivities = [];
        state.currentLicensePage = 1;
        state.currentActivityPage = 1;
        state.monthlyRevenue = 0;
        state.lifetimeRevenue = 0;
        
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
    
    function showDeleteModal(licenseKey, isStripeLicense = false) {
        state.licenseToDelete = licenseKey;
        state.isStripeLicenseToDelete = isStripeLicense;
        
        // Update modal message based on license type
        const modalBody = elements.deleteModal?.querySelector('.modal-body');
        if (modalBody) {
            const warningMessage = isStripeLicense 
                ? '<p><strong>⚠️ Stripe License:</strong> This license is linked to a Stripe subscription. Deleting it will also cancel the subscription.</p>'
                : '<p><strong>⚠️ Manual License:</strong> This license was created manually in the admin panel.</p>';
            
            modalBody.innerHTML = `
                ${warningMessage}
                <p><strong>Warning:</strong> This will permanently delete the license from the database. This action cannot be undone.</p>
                <p>Are you sure you want to delete this license?</p>
                <div class="action-buttons" style="margin-top: 20px;">
                    <button class="btn ${isStripeLicense ? 'btn-stripe-delete' : 'btn-manual-delete'}" id="confirmDelete">
                        ${isStripeLicense ? '<i class="fas fa-credit-card"></i> Delete Stripe License' : '<i class="fas fa-trash"></i> Delete Manual License'}
                    </button>
                    <button class="btn" id="cancelDelete">Cancel</button>
                </div>
            `;
            
            // Add event listeners to the new buttons
            setTimeout(() => {
                document.getElementById('confirmDelete')?.addEventListener('click', async function() {
                    if (state.licenseToDelete) {
                        try {
                            await deleteLicense(state.licenseToDelete);
                            closeModals();
                        } catch (error) {
                            // Error already shown in deleteLicense function
                        }
                    }
                });
                
                document.getElementById('cancelDelete')?.addEventListener('click', function() {
                    closeModals();
                });
            }, 100);
        }
        
        if (elements.deleteModal) {
            elements.deleteModal.classList.add('active');
        }
    }
    
    function closeModals() {
        if (elements.licenseDetailsModal) {
            elements.licenseDetailsModal.classList.remove('active');
        }
        if (elements.deactivateModal) {
            elements.deactivateModal.classList.remove('active');
        }
        if (elements.deleteModal) {
            elements.deleteModal.classList.remove('active');
        }
        state.licenseToDeactivate = null;
        state.licenseToDelete = null;
        state.isStripeLicenseToDelete = false;
    }
    
    // ========== FILTER FUNCTIONS ==========
    function filterLicenses() {
        if (state.licenses.length === 0) return;
        
        let filtered = [...state.licenses];
        
        // Apply filter
        if (state.currentFilter !== 'all') {
            filtered = filtered.filter(license => {
                const status = getLicenseStatus(license);
                const activationStatus = getActivationStatus(license);
                const plan = license.plan || 'monthly';
                const days = license.days || 30;
                
                switch(state.currentFilter) {
                    case 'active':
                        return status === 'Active';
                    case 'inactive':
                        return status === 'Inactive';
                    case 'monthly':
                        return plan === 'monthly' || days === 30;
                    case 'activated':
                        return activationStatus === 'Activated';
                    case 'not-activated':
                        return activationStatus === 'Not Activated';
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
        
        // Recalculate pages
        state.totalLicensePages = Math.ceil(state.filteredLicenses.length / state.licensesPerPage);
        if (state.totalLicensePages === 0) state.totalLicensePages = 1;
        if (state.currentLicensePage > state.totalLicensePages) state.currentLicensePage = 1;
        
        renderLicenseTable();
        renderLicensePagination();
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
                state.currentLicensePage = 1; // Reset to first page when searching
                filterLicenses();
            });
        }
        
        // Filters - UPDATED to include activation filters
        const filterButtons = document.querySelectorAll('.filter-btn');
        if (filterButtons) {
            filterButtons.forEach(btn => {
                btn.addEventListener('click', function() {
                    // Remove active class from all buttons
                    filterButtons.forEach(b => b.classList.remove('active'));
                    // Add active class to clicked button
                    this.classList.add('active');
                    state.currentFilter = this.dataset.filter;
                    state.currentLicensePage = 1; // Reset to first page when filtering
                    filterLicenses();
                });
            });
        }
        
        // Duration options
        const durationOptions = document.querySelectorAll('.duration-option');
        if (durationOptions) {
            durationOptions.forEach(option => {
                option.addEventListener('click', function() {
                    // Remove selected class from all options
                    durationOptions.forEach(o => o.classList.remove('selected'));
                    // Add selected class to clicked option
                    this.classList.add('selected');
                    state.selectedDuration = parseInt(this.dataset.days);
                    console.log('Selected duration:', state.selectedDuration, 'days');
                });
            });
        }
        
        // Generate license key
        if (elements.generateKeyBtn) {
            elements.generateKeyBtn.addEventListener('click', async function() {
                const email = elements.customerEmail ? elements.customerEmail.value.trim() : '';
                const name = elements.customerName ? elements.customerName.value.trim() : '';
                const days = state.selectedDuration;
                
                console.log('Creating license with duration:', days, 'days');
                
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
                    const license = await createLicense(email, name, days);
                    
                    // Set up email sending for the generated license
                    if (license) {
                        const sendEmailBtn = document.getElementById('sendEmailBtn');
                        if (sendEmailBtn) {
                            // Update the email button to send for this specific license
                            sendEmailBtn.onclick = async () => {
                                try {
                                    await sendLicenseEmail(license.key, email, name || email.split('@')[0]);
                                } catch (error) {
                                    // Error already shown
                                }
                            };
                        }
                    }
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
        
        // Save to DB button (already handled in createLicense)
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
        
        // Cancel deactivate button
        if (elements.cancelDeactivate) {
            elements.cancelDeactivate.addEventListener('click', function() {
                closeModals();
            });
        }
        
        // Clear all activity button
        if (elements.clearAllActivityBtn) {
            elements.clearAllActivityBtn.addEventListener('click', async function() {
                if (confirm('Are you sure you want to clear ALL activity history? This cannot be undone.')) {
                    await clearAllActivity();
                }
            });
        }
        
        // Close modal buttons
        const closeModalButtons = document.querySelectorAll('.close-modal');
        if (closeModalButtons) {
            closeModalButtons.forEach(btn => {
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
    
    // ========== INITIALIZATION ==========
    function init() {
        console.log('Initializing admin dashboard...');
        
        // Initialize DOM elements
        initDOMElements();
        
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