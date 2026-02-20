#!/bin/bash

# Script untuk menjalankan semua service di background
# Usage: ./start-all.sh [start|stop|status|logs]

set -e

COLOR_GREEN='\033[0;32m'
COLOR_BLUE='\033[0;34m'
COLOR_YELLOW='\033[1;33m'
COLOR_RED='\033[0;31m'
COLOR_RESET='\033[0m'

LOG_DIR="logs"
RABBITMQ_LOG="$LOG_DIR/rabbitmq.log"
CRAWLER_LOG="$LOG_DIR/crawler.log"
SCORING_LOG="$LOG_DIR/scoring.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

print_header() {
    echo -e "${COLOR_BLUE}================================${COLOR_RESET}"
    echo -e "${COLOR_BLUE}$1${COLOR_RESET}"
    echo -e "${COLOR_BLUE}================================${COLOR_RESET}"
}

print_success() {
    echo -e "${COLOR_GREEN}✓ $1${COLOR_RESET}"
}

print_error() {
    echo -e "${COLOR_RED}✗ $1${COLOR_RESET}"
}

print_info() {
    echo -e "${COLOR_YELLOW}→ $1${COLOR_RESET}"
}

setup_logs() {
    mkdir -p "$LOG_DIR"
    touch "$RABBITMQ_LOG" "$CRAWLER_LOG" "$SCORING_LOG" "$FRONTEND_LOG"
}

start_all() {
    print_header "Starting All Services"
    setup_logs
    
    # 1. Start RabbitMQ
    print_info "Starting RabbitMQ..."
    cd backend/crawler
    if docker ps | grep -q linkedin-rabbitmq; then
        print_info "RabbitMQ already running"
    else
        docker-compose up -d > ../../"$RABBITMQ_LOG" 2>&1
        sleep 3
        print_success "RabbitMQ started"
    fi
    cd ../..
    
    # 2. Start Crawler Consumer
    print_info "Starting Crawler Consumer..."
    cd backend/crawler
    
    if [ ! -d "venv" ]; then
        python3 -m venv venv
        source venv/bin/activate
        pip install -q -r requirements.txt
    fi
    
    if [ ! -f ".env" ]; then
        cat > .env << EOF
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
CRAWLER_QUEUE=crawler_queue
SCORING_QUEUE=scoring_queue
EOF
    fi
    
    # Kill existing process if any
    pkill -f "crawler_consumer.py" || true
    
    # Start in background
    nohup venv/bin/python crawler_consumer.py > ../../"$CRAWLER_LOG" 2>&1 &
    echo $! > ../../"$LOG_DIR/crawler.pid"
    print_success "Crawler Consumer started (PID: $!)"
    cd ../..
    
    # 3. Start Scoring Consumer
    print_info "Starting Scoring Consumer..."
    cd backend/scoring
    
    if [ ! -d "venv" ]; then
        python3 -m venv venv
        source venv/bin/activate
        pip install -q -r requirements.txt
    fi
    
    if [ ! -f ".env" ]; then
        print_error ".env file not found in backend/scoring!"
        print_info "Please create .env with Supabase credentials"
        cd ../..
        stop_all
        exit 1
    fi
    
    # Kill existing process if any
    pkill -f "scoring_consumer.py" || true
    
    # Start in background
    nohup venv/bin/python scoring_consumer.py > ../../"$SCORING_LOG" 2>&1 &
    echo $! > ../../"$LOG_DIR/scoring.pid"
    print_success "Scoring Consumer started (PID: $!)"
    cd ../..
    
    # 4. Start Frontend
    print_info "Starting Frontend..."
    cd frontend
    
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    if [ ! -f ".env.local" ]; then
        print_error ".env.local file not found in frontend!"
        print_info "Please create .env.local with Supabase credentials"
        cd ..
        stop_all
        exit 1
    fi
    
    # Kill existing process if any
    pkill -f "next dev" || true
    
    # Start in background
    nohup npm run dev > ../"$FRONTEND_LOG" 2>&1 &
    echo $! > ../"$LOG_DIR/frontend.pid"
    print_success "Frontend started (PID: $!)"
    cd ..
    
    echo ""
    print_success "All services started!"
    echo ""
    print_info "Access points:"
    echo "  - Frontend Dashboard: http://localhost:3000"
    echo "  - RabbitMQ Management: http://localhost:15672 (guest/guest)"
    echo ""
    print_info "View logs:"
    echo "  ./start-all.sh logs"
    echo ""
    print_info "Check status:"
    echo "  ./start-all.sh status"
    echo ""
    print_info "Stop all services:"
    echo "  ./start-all.sh stop"
}

stop_all() {
    print_header "Stopping All Services"
    
    # Stop RabbitMQ
    print_info "Stopping RabbitMQ..."
    cd backend/crawler
    docker-compose down > /dev/null 2>&1 || true
    cd ../..
    
    # Stop Crawler
    if [ -f "$LOG_DIR/crawler.pid" ]; then
        PID=$(cat "$LOG_DIR/crawler.pid")
        kill $PID 2>/dev/null || true
        rm "$LOG_DIR/crawler.pid"
        print_success "Crawler stopped"
    fi
    pkill -f "crawler_consumer.py" || true
    
    # Stop Scoring
    if [ -f "$LOG_DIR/scoring.pid" ]; then
        PID=$(cat "$LOG_DIR/scoring.pid")
        kill $PID 2>/dev/null || true
        rm "$LOG_DIR/scoring.pid"
        print_success "Scoring stopped"
    fi
    pkill -f "scoring_consumer.py" || true
    
    # Stop Frontend
    if [ -f "$LOG_DIR/frontend.pid" ]; then
        PID=$(cat "$LOG_DIR/frontend.pid")
        kill $PID 2>/dev/null || true
        rm "$LOG_DIR/frontend.pid"
        print_success "Frontend stopped"
    fi
    pkill -f "next dev" || true
    
    print_success "All services stopped"
}

show_status() {
    print_header "Service Status"
    
    echo -e "\n${COLOR_YELLOW}RabbitMQ:${COLOR_RESET}"
    if docker ps | grep -q linkedin-rabbitmq; then
        print_success "Running - http://localhost:15672"
    else
        print_error "Not running"
    fi
    
    echo -e "\n${COLOR_YELLOW}Crawler Consumer:${COLOR_RESET}"
    if pgrep -f "crawler_consumer.py" > /dev/null; then
        PID=$(pgrep -f "crawler_consumer.py")
        print_success "Running (PID: $PID)"
    else
        print_error "Not running"
    fi
    
    echo -e "\n${COLOR_YELLOW}Scoring Consumer:${COLOR_RESET}"
    if pgrep -f "scoring_consumer.py" > /dev/null; then
        PID=$(pgrep -f "scoring_consumer.py")
        print_success "Running (PID: $PID)"
    else
        print_error "Not running"
    fi
    
    echo -e "\n${COLOR_YELLOW}Frontend:${COLOR_RESET}"
    if pgrep -f "next dev" > /dev/null; then
        PID=$(pgrep -f "next dev")
        print_success "Running (PID: $PID) - http://localhost:3000"
    else
        print_error "Not running"
    fi
    
    echo ""
}

show_logs() {
    print_header "Service Logs"
    
    if [ ! -d "$LOG_DIR" ]; then
        print_error "No logs found. Services not started yet?"
        exit 1
    fi
    
    echo -e "\n${COLOR_YELLOW}Select log to view:${COLOR_RESET}"
    echo "1. Crawler"
    echo "2. Scoring"
    echo "3. Frontend"
    echo "4. All (tail -f)"
    echo -n "Choice [1-4]: "
    read choice
    
    case $choice in
        1)
            tail -f "$CRAWLER_LOG"
            ;;
        2)
            tail -f "$SCORING_LOG"
            ;;
        3)
            tail -f "$FRONTEND_LOG"
            ;;
        4)
            tail -f "$CRAWLER_LOG" "$SCORING_LOG" "$FRONTEND_LOG"
            ;;
        *)
            print_error "Invalid choice"
            ;;
    esac
}

restart_all() {
    print_header "Restarting All Services"
    stop_all
    sleep 2
    start_all
}

start_crawler_visible() {
    print_header "Starting Crawler with VISIBLE Browser"
    
    # 1. Start RabbitMQ
    print_info "Starting RabbitMQ..."
    cd backend/crawler
    if docker ps | grep -q linkedin-rabbitmq; then
        print_info "RabbitMQ already running"
    else
        docker compose up -d 2>/dev/null || docker-compose up -d 2>/dev/null
        sleep 3
        print_success "RabbitMQ started"
    fi
    
    # 2. Setup venv
    if [ ! -d "venv" ]; then
        print_info "Creating virtual environment..."
        python3 -m venv venv
        source venv/bin/activate
        pip install -q -r requirements.txt
    else
        source venv/bin/activate
    fi
    
    # 3. Check .env
    if [ ! -f ".env" ]; then
        print_error ".env file not found!"
        print_info "Please create .env file with LinkedIn credentials"
        cd ../..
        exit 1
    fi
    
    echo ""
    print_success "Setup complete!"
    echo ""
    print_info "Browser window will appear shortly..."
    print_info "Press Ctrl+C to stop"
    echo ""
    print_info "RabbitMQ Management: http://localhost:15672 (guest/guest)"
    echo ""
    
    # 4. Run crawler in foreground (browser visible)
    python crawler_consumer.py
}

show_help() {
    echo "Usage: ./start-all.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start          - Start all services in background"
    echo "  start-visible  - Start crawler with VISIBLE browser (foreground)"
    echo "  start-scheduler - Start scheduler daemon (auto-crawl from Supabase)"
    echo "  stop           - Stop all services"
    echo "  restart        - Restart all services"
    echo "  status         - Show status of all services"
    echo "  logs           - View service logs"
    echo "  help           - Show this help"
    echo ""
    echo "Examples:"
    echo "  ./start-all.sh start"
    echo "  ./start-all.sh start-visible    # Browser akan muncul"
    echo "  ./start-all.sh start-scheduler  # Auto-crawl dari schedule"
    echo "  ./start-all.sh status"
    echo "  ./start-all.sh logs"
    echo "  ./start-all.sh stop"
}

start_scheduler_daemon() {
    print_header "Starting Scheduler Daemon"
    
    cd backend/crawler
    
    # Setup venv
    if [ ! -d "venv" ]; then
        print_info "Creating virtual environment..."
        python3 -m venv venv
        source venv/bin/activate
        pip install -q -r requirements.txt
    else
        source venv/bin/activate
    fi
    
    # Check .env
    if [ ! -f ".env" ]; then
        print_error ".env file not found!"
        print_info "Please create .env file with Supabase credentials"
        cd ../..
        exit 1
    fi
    
    # Check Supabase credentials
    if ! grep -q "SUPABASE_URL=https://" .env; then
        print_error "SUPABASE_URL not configured in .env!"
        print_info "Please update .env with your Supabase credentials"
        cd ../..
        exit 1
    fi
    
    echo ""
    print_success "Setup complete!"
    echo ""
    print_info "Scheduler daemon will:"
    echo "  - Check Supabase every 5 minutes for pending schedules"
    echo "  - Auto-crawl profiles when schedule time arrives"
    echo "  - Save results to Supabase"
    echo ""
    print_info "Press Ctrl+C to stop"
    echo ""
    
    # Run scheduler daemon
    python scheduler_daemon.py
}

# Main
case "${1:-help}" in
    start)
        start_all
        ;;
    start-visible)
        start_crawler_visible
        ;;
    start-scheduler)
        start_scheduler_daemon
        ;;
    stop)
        stop_all
        ;;
    restart)
        restart_all
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    help|*)
        show_help
        ;;
esac
