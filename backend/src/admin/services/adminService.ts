import { adminRepository } from '../repositories/adminRepository.js';

// ============================================================
// Admin Service — Aggregates data from the read-only repository
// No writes. No mutations. Observation only.
// ============================================================

export const adminService = {
  async getOverview() {
    return adminRepository.getOverview();
  },

  async getLiveUsers() {
    return adminRepository.getLiveUsers();
  },

  async getLocations() {
    return adminRepository.getLocations();
  },

  async getColleges() {
    return adminRepository.getColleges();
  },

  async getFilters() {
    return adminRepository.getFilters();
  },

  async getDevices() {
    return adminRepository.getDevices();
  },

  async getQueue() {
    return adminRepository.getQueue();
  },

  async getMatches() {
    return adminRepository.getMatches();
  },

  async getMetricsHistory(limit?: number) {
    return adminRepository.getMetricsHistory(limit);
  },
};
