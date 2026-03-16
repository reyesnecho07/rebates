// src/services/reportService.js

class ReportService {
  constructor() {
    this.jobs = new Map();
    this.STORAGE_KEYS = {
      JOB_IDS: 'report_job_ids',
      JOB_DATA: 'report_job_data_'
    };
    
    // Initialize from storage
    this.initializeFromStorage();
  }

  // Initialize jobs from localStorage
  initializeFromStorage() {
    const jobIds = this.getUserJobIds();
    jobIds.forEach(jobId => {
      const jobData = this.getJobFromStorage(jobId);
      if (jobData) {
        this.jobs.set(jobId, jobData);
      }
    });
  }

  // Generate a unique job ID
  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Start a new report generation job
  async startReportGeneration(parameters, customers) {
    const jobId = this.generateJobId();
    
    // Get customer name for display
    const customerName = this.getCustomerName(parameters.selectedCustomer, customers);
    
    console.log("Starting job with customer:", customerName, "from customers:", customers); // Debug log
    
    // Create job data
    const jobData = {
      id: jobId,
      status: 'processing',
      parameters: parameters,
      customerName: customerName, // Store customer name for display
      result: null,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Store job data
    this.jobs.set(jobId, jobData);
    this.saveJobToStorage(jobId, jobData);
    
    // Store job ID in user's job list
    this.addJobToUserList(jobId);

    // Simulate background processing
    this.processJobInBackground(jobId, parameters, customers);

    return jobId;
  }

  // Process job in background (simulated)
  async processJobInBackground(jobId, parameters, customers) {
    try {
      // Update status to processing
      this.updateJobStatus(jobId, 'processing', null, null);

      // Fetch data from API (your existing logic)
      const reportData = await this.fetchReportData(parameters, customers);
      
      // Update job status to completed
      this.updateJobStatus(jobId, 'completed', reportData, null);

    } catch (error) {
      console.error('Job processing failed:', error);
      // Update job status to failed
      this.updateJobStatus(jobId, 'failed', null, error.message);
    }
  }

  // Update job status
  updateJobStatus(jobId, status, result, error) {
    const jobData = this.jobs.get(jobId);
    if (jobData) {
      jobData.status = status;
      jobData.result = result;
      jobData.error = error;
      jobData.updatedAt = new Date().toISOString();
      
      this.jobs.set(jobId, jobData);
      this.saveJobToStorage(jobId, jobData);
    }
  }

  // Fetch report data (your existing API call logic)
  async fetchReportData(parameters, customers) {
    const { selectedCustomer, dateFrom, dateTo } = parameters;
    
    try {
      const response = await fetch("http://192.168.100.193:3006/api/nexchem/invoice");
      const invoiceData = await response.json();

      // Get customer name
      const selectedCustomerName = this.getCustomerName(selectedCustomer, customers);
      
      let filteredData = invoiceData.filter(invoice => {
        const customerMatch = invoice.CardName === selectedCustomerName;
        if (!customerMatch) return false;

        if (dateFrom && dateTo) {
          try {
            const invoiceDate = new Date(invoice.Docdate);
            const fromDate = new Date(dateFrom);
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            
            return invoiceDate >= fromDate && invoiceDate <= toDate;
          } catch (error) {
            console.error("Error parsing dates:", error);
            return true;
          }
        }
        
        return true;
      });

      // Group data by DocNum (AR Invoice number)
      const groupedData = filteredData.reduce((acc, invoice) => {
        const docNum = invoice.DocNum.toString();
        if (!acc[docNum]) {
          acc[docNum] = {
            id: docNum,
            docDate: invoice.Docdate,
            items: []
          };
        }
        
        const kitanex = this.generateRandomKitanex();
        
        acc[docNum].items.push({
          name: invoice.Dscription,
          qty: invoice.Quantity,
          sales_amt: invoice.LineTotal,
          kitanex: kitanex,
          total_kitanex: kitanex * invoice.Quantity
        });
        
        return acc;
      }, {});

      const reportDataArray = Object.values(groupedData).sort((a, b) => {
        return new Date(a.docDate) - new Date(b.docDate);
      });

      return reportDataArray;

    } catch (error) {
      console.error("Error fetching report data:", error);
      
      // Fallback to mock data if API fails
      return this.generateMockData(parameters, customers);
    }
  }

  // Generate mock data for testing
  generateMockData(parameters, customers) {
    const { selectedCustomer, dateFrom, dateTo } = parameters;
    const customerName = this.getCustomerName(selectedCustomer, customers);
    const mockInvoices = [];
    
    const invoiceCount = Math.floor(Math.random() * 3) + 3;
    
    let startDate, endDate;
    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom);
      endDate = new Date(dateTo);
    } else {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    }
    
    for (let i = 0; i < invoiceCount; i++) {
      const invoiceNum = `INV${1000 + i}`;
      
      const timeDiff = endDate.getTime() - startDate.getTime();
      const randomTime = startDate.getTime() + Math.random() * timeDiff;
      const docDate = new Date(randomTime);
      
      const invoice = {
        id: invoiceNum,
        docDate: docDate.toISOString(),
        items: []
      };
      
      const itemCount = Math.floor(Math.random() * 3) + 2;
      for (let j = 0; j < itemCount; j++) {
        const kitanex = this.generateRandomKitanex();
        const qty = Math.floor(Math.random() * 100) + 10;
        const salesAmt = (Math.random() * 1000 + 100).toFixed(2);
        
        invoice.items.push({
          name: `Product ${String.fromCharCode(65 + j)}`,
          qty: qty,
          sales_amt: parseFloat(salesAmt),
          kitanex: kitanex,
          total_kitanex: kitanex * qty
        });
      }
      
      mockInvoices.push(invoice);
    }
    
    return mockInvoices.sort((a, b) => new Date(a.docDate) - new Date(b.docDate));
  }

  // Get job status
  getJobStatus(jobId) {
    // First check memory
    if (this.jobs.has(jobId)) {
      return this.jobs.get(jobId);
    }
    
    // Then check storage
    return this.getJobFromStorage(jobId);
  }

  // Get all user jobs
  getUserJobs() {
    const jobIds = this.getUserJobIds();
    const jobs = [];
    
    jobIds.forEach(jobId => {
      const jobData = this.getJobStatus(jobId);
      if (jobData) {
        jobs.push(jobData);
      }
    });
    
    return jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // Storage methods
  saveJobToStorage(jobId, jobData) {
    try {
      localStorage.setItem(
        `${this.STORAGE_KEYS.JOB_DATA}${jobId}`, 
        JSON.stringify(jobData)
      );
    } catch (error) {
      console.error('Error saving job to storage:', error);
    }
  }

  getJobFromStorage(jobId) {
    try {
      const data = localStorage.getItem(`${this.STORAGE_KEYS.JOB_DATA}${jobId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error reading job from storage:', error);
      return null;
    }
  }

  addJobToUserList(jobId) {
    try {
      const jobIds = this.getUserJobIds();
      jobIds.unshift(jobId); // Add to beginning
      
      // Keep only last 10 jobs to prevent storage overflow
      const limitedIds = jobIds.slice(0, 10);
      
      localStorage.setItem(
        this.STORAGE_KEYS.JOB_IDS, 
        JSON.stringify(limitedIds)
      );
    } catch (error) {
      console.error('Error adding job to user list:', error);
    }
  }

  getUserJobIds() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.JOB_IDS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading user job IDs:', error);
      return [];
    }
  }

  // Helper methods
  getCustomerName(cardCode, customers) {
    if (!cardCode || !customers || customers.length === 0) {
      console.log("Missing data - cardCode:", cardCode, "customers:", customers);
      return "Unknown Customer";
    }
    
    const customer = customers.find(c => c.CardCode === cardCode);
    const customerName = customer ? customer.CardName : "Unknown Customer";
    console.log("Found customer:", customerName, "for code:", cardCode);
    return customerName;
  }

  generateRandomKitanex() {
    return Math.floor(Math.random() * 36) + 5;
  }

  // Clean up old jobs (optional)
  cleanupOldJobs(maxAgeHours = 24) {
    const jobIds = this.getUserJobIds();
    const now = new Date();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    
    jobIds.forEach(jobId => {
      const jobData = this.getJobFromStorage(jobId);
      if (jobData) {
        const jobAge = now - new Date(jobData.createdAt);
        if (jobAge > maxAgeMs) {
          this.deleteJob(jobId);
        }
      }
    });
  }

  deleteJob(jobId) {
    // Remove from memory
    this.jobs.delete(jobId);
    
    // Remove from storage
    try {
      localStorage.removeItem(`${this.STORAGE_KEYS.JOB_DATA}${jobId}`);
      
      // Remove from user job list
      const jobIds = this.getUserJobIds();
      const updatedIds = jobIds.filter(id => id !== jobId);
      localStorage.setItem(this.STORAGE_KEYS.JOB_IDS, JSON.stringify(updatedIds));
    } catch (error) {
      console.error('Error deleting job:', error);
    }
  }
}

// Create a singleton instance
export const reportService = new ReportService();