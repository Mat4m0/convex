<script setup lang="ts">
import { api } from '~~/convex/_generated/api'

/**
 * Test page for action status tracking
 *
 * Tests all states of useConvexAction:
 * - idle: initial state, no action running
 * - pending: action in progress
 * - success: action completed successfully
 * - error: action failed
 *
 * Also tests reset() function and data ref
 */

// Successful action
const {
  execute: runEcho,
  pending: echoPending,
  status: echoStatus,
  error: echoError,
  data: echoData,
  reset: echoReset,
} = useConvexAction(api.testing.echo)

// Error action
const {
  execute: runFail,
  pending: failPending,
  status: failStatus,
  error: failError,
  reset: failReset,
} = useConvexAction(api.testing.alwaysFailsAction)

// Track action counts
const successCount = ref(0)
const errorCount = ref(0)
const messageInput = ref('Hello from E2E test')

async function handleSuccess() {
  try {
    await runEcho({ message: messageInput.value })
    successCount.value++
  } catch {
    // Error is tracked in error ref
  }
}

async function handleError() {
  try {
    await runFail({})
  } catch {
    // Expected to fail
    errorCount.value++
  }
}

function handleReset() {
  echoReset()
  failReset()
}
</script>

<template>
  <div data-testid="action-status-page" class="test-page">
    <h1>Action Status Tracking</h1>

    <section class="control-section">
      <div class="input-group">
        <input
          v-model="messageInput"
          data-testid="message-input"
          type="text"
          placeholder="Message to echo"
        />
      </div>

      <div class="button-group">
        <button
          data-testid="success-btn"
          class="btn success-btn"
          :disabled="echoPending"
          @click="handleSuccess"
        >
          {{ echoPending ? 'Running...' : 'Run Echo Action' }}
        </button>

        <button
          data-testid="error-btn"
          class="btn error-btn"
          :disabled="failPending"
          @click="handleError"
        >
          {{ failPending ? 'Running...' : 'Run Error Action' }}
        </button>

        <button
          data-testid="reset-btn"
          class="btn reset-btn"
          @click="handleReset"
        >
          Reset All
        </button>
      </div>
    </section>

    <section class="state-section">
      <h2>Echo Action State</h2>
      <div class="state-grid">
        <div class="state-item">
          <span class="label">status:</span>
          <span data-testid="echo-status" class="value">{{ echoStatus }}</span>
        </div>
        <div class="state-item">
          <span class="label">pending:</span>
          <span data-testid="echo-pending" class="value">{{ echoPending }}</span>
        </div>
        <div class="state-item">
          <span class="label">error:</span>
          <span data-testid="echo-error" class="value">{{ echoError?.message ?? 'null' }}</span>
        </div>
        <div class="state-item">
          <span class="label">data.echoed:</span>
          <span data-testid="echo-data" class="value">{{ echoData?.echoed ?? 'undefined' }}</span>
        </div>
        <div class="state-item">
          <span class="label">data.timestamp:</span>
          <span data-testid="echo-timestamp" class="value">{{ echoData?.timestamp ?? 'undefined' }}</span>
        </div>
        <div class="state-item">
          <span class="label">success count:</span>
          <span data-testid="success-count" class="value">{{ successCount }}</span>
        </div>
      </div>
    </section>

    <section class="state-section error">
      <h2>Error Action State</h2>
      <div class="state-grid">
        <div class="state-item">
          <span class="label">status:</span>
          <span data-testid="fail-status" class="value">{{ failStatus }}</span>
        </div>
        <div class="state-item">
          <span class="label">pending:</span>
          <span data-testid="fail-pending" class="value">{{ failPending }}</span>
        </div>
        <div class="state-item">
          <span class="label">error:</span>
          <span data-testid="fail-error" class="value">{{ failError?.message ?? 'null' }}</span>
        </div>
        <div class="state-item">
          <span class="label">error count:</span>
          <span data-testid="error-count" class="value">{{ errorCount }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.test-page {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.control-section {
  margin: 20px 0;
}

.input-group {
  margin-bottom: 15px;
}

.input-group input {
  width: 100%;
  padding: 10px;
  font-size: 14px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.button-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn {
  padding: 10px 20px;
  font-size: 14px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.success-btn { background: #4caf50; color: white; }
.error-btn { background: #f44336; color: white; }
.reset-btn { background: #9e9e9e; color: white; }

.btn:disabled { opacity: 0.6; cursor: not-allowed; }

.state-section {
  margin: 20px 0;
  padding: 15px;
  background: #f8f8f8;
  border-radius: 8px;
}

.state-section.error {
  background: #fff5f5;
}

.state-section h2 {
  margin: 0 0 15px;
  font-size: 1rem;
}

.state-grid {
  display: grid;
  gap: 8px;
}

.state-item {
  display: flex;
  gap: 10px;
}

.label {
  font-weight: 500;
  min-width: 130px;
}

.value {
  font-family: monospace;
  background: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  word-break: break-all;
}
</style>
