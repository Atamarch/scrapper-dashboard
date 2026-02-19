# Helper Modules

Folder ini berisi helper modules yang digunakan oleh LinkedIn crawler untuk memisahkan concerns dan membuat code lebih maintainable.

## Struktur

### 1. `browser_helper.py`
**Fungsi**: Mengelola browser automation dan anti-detection
- `create_driver()` - Setup Chrome WebDriver dengan konfigurasi anti-detection
  - Deteksi otomatis production mode (Docker/Render) via environment variables
  - Mode headless otomatis di production untuk stabilitas
  - Support mobile dan desktop mode
- `human_delay()` - Random delay untuk meniru behavior manusia
- `profile_delay()` - Delay lebih lama antar profil
- `random_mouse_movement()` - Simulasi gerakan mouse
- `smooth_scroll()` - Scroll smooth ke element
- `scroll_page_to_load()` - Scroll halaman untuk load lazy content

**Environment Variables**:
- `RENDER=true` atau `DOCKER=true` - Aktifkan headless mode untuk production
- `USE_MOBILE_MODE=true` - Gunakan mobile emulation
- `MIN_DELAY`, `MAX_DELAY` - Konfigurasi delay antar aksi
- `PROFILE_DELAY_MIN`, `PROFILE_DELAY_MAX` - Delay antar profil

### 2. `auth_helper.py`
**Fungsi**: Menangani autentikasi LinkedIn
- `login()` - Login ke LinkedIn dengan auto-detection verifikasi
- `save_cookies()` - Simpan cookies untuk persistent session
- `load_cookies()` - Load cookies dari file

### 3. `extraction_helper.py`
**Fungsi**: Helper untuk ekstraksi data dari halaman LinkedIn
- `click_show_all()` - Klik tombol "Show all" di section
- `click_back_arrow()` - Klik tombol back di detail page
- `extract_items_from_detail_page()` - Extract items dari detail page

### 4. `rabbitmq_helper.py`
**Fungsi**: Manajemen RabbitMQ queue
- `RabbitMQManager` class - Manage connection dan operations
  - `connect()` - Connect ke RabbitMQ server
  - `publish_url()` - Publish single URL ke queue
  - `publish_urls()` - Publish multiple URLs
  - `consume()` - Consume messages dari queue
  - `get_queue_size()` - Get jumlah messages di queue
  - `purge_queue()` - Hapus semua messages
  - `close()` - Close connection
- `ack_message()` - Acknowledge message (mark as processed)
- `nack_message()` - Negative acknowledge (reject message)

## Penggunaan

```python
# Import helper modules
from helper.browser_helper import create_driver, human_delay
from helper.auth_helper import login
from helper.extraction_helper import click_show_all
from helper.rabbitmq_helper import RabbitMQManager

# Gunakan di code
driver = create_driver()
login(driver)
human_delay(2, 5)
```

## Keuntungan Struktur Ini

1. **Separation of Concerns** - Setiap helper punya tanggung jawab spesifik
2. **Reusability** - Helper bisa digunakan di multiple files
3. **Maintainability** - Lebih mudah debug dan update
4. **Testability** - Lebih mudah untuk unit testing
5. **Readability** - Code lebih bersih dan mudah dipahami
