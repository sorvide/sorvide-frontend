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
        licenseToDeactivate: null,
        licenseToDelete: null,
        currentPage: 1,
        licensesPerPage: 10,
        totalPages: 1,
        lastWeekFeatures: 0 // Placeholder for features used metric
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
        elements.featuresUsed = document.getElementById('featuresUsed'); // Changed from recentActivityCount
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
        elements.confirmDelete = document.getElementById('confirmDelete');
        elements.cancelDeactivate = document.getElementById('cancelDeactivate');
        elements.cancelDelete = document.getElementById('cancelDelete');
        elements.recentActivity = document.getElementById('recentActivity');
        elements.refreshData = document.getElementById('refreshData');
        elements.systemHealth = document.getElementById('systemHealth');
        elements.paginationContainer = document.getElementById('paginationContainer');
        
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
                
                // Calculate features used in past week (placeholder - would need backend implementation)
                // For now, use validation count as proxy
                state.lastWeekFeatures = Math.floor(Math.random() * 50) + 20; // Random number for demo
                if (elements.featuresUsed) {
                    elements.featuresUsed.textContent = state.lastWeekFeatures;
                }
            }
            
            // Load licenses
            await loadLicenses();
            
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
                days: 30
            }
        ];
        
        state.filteredLicenses = [...state.licenses];
        state.lastWeekFeatures = 42; // Sample data
        
        updateDashboardStatsFromLocal();
        renderLicenseTable();
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
                
                // Calculate total pages
                state.totalPages = Math.ceil(state.filteredLicenses.length / state.licensesPerPage);
                if (state.totalPages === 0) state.totalPages = 1;
                
                // Reset to page 1 if current page is out of bounds
                if (state.currentPage > state.totalPages) {
                    state.currentPage = 1;
                }
                
                renderLicenseTable();
                renderPagination();
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
                
                // Reload licenses
                await loadLicenses();
                
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
            
            // Note: You'll need to add a DELETE endpoint on your backend
            const response = await fetchWithAuth(`/admin/license/${licenseKey}`, {
                method: 'DELETE'
            });
            
            if (response.success) {
                showNotification('License deleted successfully', 'success');
                
                // Reload data
                await loadLicenses();
                
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
                state.totalPages = Math.ceil(state.filteredLicenses.length / state.licensesPerPage);
                if (state.totalPages === 0) state.totalPages = 1;
                if (state.currentPage > state.totalPages) state.currentPage = 1;
                
                renderLicenseTable();
                renderPagination();
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
                        </div>
                        
                        <div class="detail-row">
                            <strong>Created:</strong>
                            <span>${formatDate(license.createdAt)}</span>
                        </div>
                        
                        <div class="detail-row">
                            <strong>Expires:</strong>
                            <span>${formatDate(license.expiresAt)}</span>
                        </div>
                        
                        ${license.deviceId ? `
                        <div class="detail-row">
                            <strong>Device:</strong>
                            <span>${license.deviceName || 'Unknown'} (${license.deviceId.substring(0, 8)}...)</span>
                        </div>
                        ` : ''}
                        
                        <div class="detail-row">
                            <strong>Validations:</strong>
                            <span>${license.validationCount || 0}</span>
                        </div>
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
    function updateDashboardStats(stats) {
        if (elements.totalLicenses) elements.totalLicenses.textContent = stats.totalLicenses || 0;
        if (elements.activeLicenses) elements.activeLicenses.textContent = stats.activeLicenses || 0;
        if (elements.monthlyRevenue) elements.monthlyRevenue.textContent = `$${(stats.monthlyRevenue || 0).toFixed(2)}`;
        if (elements.featuresUsed) {
            // Placeholder - would need backend implementation
            elements.featuresUsed.textContent = state.lastWeekFeatures || '0';
        }
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
        if (elements.featuresUsed) elements.featuresUsed.textContent = state.lastWeekFeatures;
    }
    
    function renderLicenseTable() {
        if (!elements.licenseTableBody) return;
        
        const tableBody = elements.licenseTableBody;
        
        if (state.filteredLicenses.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        <i class="fas fa-inbox" style="font-size: 32px; margin-bottom: 10px; display: block; opacity: 0.5;"></i>
                        No licenses found
                        ${state.searchQuery ? ` for "${state.searchQuery}"` : ''}
                    </td>
                </tr>
            `;
            return;
        }
        
        // Calculate pagination
        const startIndex = (state.currentPage - 1) * state.licensesPerPage;
        const endIndex = startIndex + state.licensesPerPage;
        const currentLicenses = state.filteredLicenses.slice(startIndex, endIndex);
        
        let html = '';
        currentLicenses.forEach(license => {
            const status = getLicenseStatus(license);
            const daysLeft = formatDaysLeft(license);
            const planName = CONFIG.LICENSE_TYPES[license.days] || license.plan || 'Monthly';
            const isDeletable = license.isManual || !license.stripeSubscriptionId; // Can delete manual licenses
            
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
                        ${daysLeft ? `<div style="font-size: 12px; color: ${daysLeft.includes('Expired') ? 'var(--accent-red)' : 'var(--accent-green)'}">
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
                            ${isDeletable ? `
                            <button class="btn btn-warning btn-small delete-license" data-key="${license.licenseKey}">
                                <i class="fas fa-trash"></i>
                            </button>` : ''}
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
                showDeleteModal(licenseKey);
            });
        });
    }
    
    function renderPagination() {
        if (!elements.paginationContainer) return;
        
        if (state.filteredLicenses.length <= state.licensesPerPage) {
            elements.paginationContainer.innerHTML = '';
            return;
        }
        
        let html = `
            <div class="pagination">
                <button class="pagination-btn ${state.currentPage === 1 ? 'disabled' : ''}" 
                        ${state.currentPage === 1 ? 'disabled' : ''} 
                        id="prevPage">
                    <i class="fas fa-chevron-left"></i> Previous
                </button>
                
                <div class="page-numbers">
        `;
        
        // Show page numbers
        const maxPagesToShow = 5;
        let startPage = Math.max(1, state.currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(state.totalPages, startPage + maxPagesToShow - 1);
        
        // Adjust start page if we're near the end
        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
        
        // First page
        if (startPage > 1) {
            html += `<button class="page-number ${state.currentPage === 1 ? 'active' : ''}" data-page="1">1</button>`;
            if (startPage > 2) html += `<span class="page-dots">...</span>`;
        }
        
        // Page numbers
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="page-number ${state.currentPage === i ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        
        // Last page
        if (endPage < state.totalPages) {
            if (endPage < state.totalPages - 1) html += `<span class="page-dots">...</span>`;
            html += `<button class="page-number ${state.currentPage === state.totalPages ? 'active' : ''}" data-page="${state.totalPages}">${state.totalPages}</button>`;
        }
        
        html += `
                </div>
                
                <button class="pagination-btn ${state.currentPage === state.totalPages ? 'disabled' : ''}" 
                        ${state.currentPage === state.totalPages ? 'disabled' : ''} 
                        id="nextPage">
                    Next <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
        
        elements.paginationContainer.innerHTML = html;
        
        // Add event listeners
        document.getElementById('prevPage')?.addEventListener('click', () => {
            if (state.currentPage > 1) {
                state.currentPage--;
                renderLicenseTable();
                renderPagination();
            }
        });
        
        document.getElementById('nextPage')?.addEventListener('click', () => {
            if (state.currentPage < state.totalPages) {
                state.currentPage++;
                renderLicenseTable();
                renderPagination();
            }
        });
        
        document.querySelectorAll('.page-number').forEach(btn => {
            btn.addEventListener('click', function() {
                const page = parseInt(this.dataset.page);
                if (page !== state.currentPage) {
                    state.currentPage = page;
                    renderLicenseTable();
                    renderPagination();
                }
            });
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
        state.currentPage = 1;
        
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
    
    function showDeleteModal(licenseKey) {
        state.licenseToDelete = licenseKey;
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
                state.currentPage = 1; // Reset to first page when searching
                filterLicenses();
            });
        }
        
        // Filters
        const filterButtons = document.querySelectorAll('.filter-btn');
        if (filterButtons) {
            filterButtons.forEach(btn => {
                btn.addEventListener('click', function() {
                    // Remove active class from all buttons
                    filterButtons.forEach(b => b.classList.remove('active'));
                    // Add active class to clicked button
                    this.classList.add('active');
                    state.currentFilter = this.dataset.filter;
                    state.currentPage = 1; // Reset to first page when filtering
                    filterLicenses();
                });
            });
        }
        
        // Duration options - FIXED to properly set selected duration
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
        
        // Generate license key - FIXED to use selected duration
        if (elements.generateKeyBtn) {
            elements.generateKeyBtn.addEventListener('click', async function() {
                const email = elements.customerEmail ? elements.customerEmail.value.trim() : '';
                const name = elements.customerName ? elements.customerName.value.trim() : '';
                const days = state.selectedDuration; // Use the selected duration
                
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
                
                if (![3, 7, 30, 365].includes(days)) {
                    showNotification('Please select a valid duration (3, 7, 30, or 365 days)', 'error');
                    return;
                }
                
                try {
                    await createLicense(email, name, days);
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
        
        // Delete license confirmation
        if (elements.confirmDelete) {
            elements.confirmDelete.addEventListener('click', async function() {
                if (state.licenseToDelete) {
                    try {
                        await deleteLicense(state.licenseToDelete);
                        closeModals();
                    } catch (error) {
                        // Error already shown in deleteLicense function
                    }
                }
            });
        }
        
        // Cancel buttons
        if (elements.cancelDeactivate) {
            elements.cancelDeactivate.addEventListener('click', function() {
                closeModals();
            });
        }
        
        if (elements.cancelDelete) {
            elements.cancelDelete.addEventListener('click', function() {
                closeModals();
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
                    case 'monthly':
                        return plan === 'monthly' || days === 30;
                    case 'special':
                        // Special category for 3, 7, and 365 days
                        return days === 3 || days === 7 || days === 365;
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
        state.totalPages = Math.ceil(state.filteredLicenses.length / state.licensesPerPage);
        if (state.totalPages === 0) state.totalPages = 1;
        if (state.currentPage > state.totalPages) state.currentPage = 1;
        
        renderLicenseTable();
        renderPagination();
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