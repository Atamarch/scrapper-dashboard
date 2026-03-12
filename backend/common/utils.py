"""
Common utilities shared across crawler and scoring modules
"""
import hashlib
import threading
from datetime import datetime


def get_profile_hash(profile_url):
    """Generate unique hash from profile URL"""
    return hashlib.md5(profile_url.encode()).hexdigest()[:8]


class StatsManager:
    """Thread-safe statistics manager"""
    
    def __init__(self):
        self.stats = {
            'processing': 0,
            'completed': 0,
            'failed': 0,
            'skipped': 0,
            'lock': threading.Lock()
        }
    
    def increment(self, key):
        """Thread-safe increment"""
        with self.stats['lock']:
            if key in self.stats:
                self.stats[key] += 1
    
    def decrement(self, key):
        """Thread-safe decrement"""
        with self.stats['lock']:
            if key in self.stats:
                self.stats[key] -= 1
    
    def get_stats(self):
        """Get current stats copy"""
        with self.stats['lock']:
            return self.stats.copy()
    
    def print_stats(self, title="STATISTICS"):
        """Print current statistics"""
        stats_copy = self.get_stats()
        print("\n" + "="*60)
        print(title)
        print("="*60)
        print(f"Processing: {stats_copy['processing']}")
        print(f"Completed: {stats_copy['completed']}")
        print(f"Failed: {stats_copy['failed']}")
        print(f"Skipped: {stats_copy['skipped']}")
        
        if stats_copy['completed'] + stats_copy['failed'] > 0:
            success_rate = stats_copy['completed'] / (stats_copy['completed'] + stats_copy['failed']) * 100
            print(f"Success Rate: {success_rate:.1f}%")
        print("="*60)