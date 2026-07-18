export default function BottomNavBar() {
    return (
        <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-base py-3 bg-surface/80 backdrop-blur-xl shadow-[0_-4px_20px_0_rgba(125,86,45,0.1)] rounded-t-xl">
            <a className="flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-full px-4 py-1 active:scale-90 duration-150" href="#">
                <span className="material-symbols-outlined">dashboard</span>
                <span className="font-label-sm text-label-sm">Dashboard</span>
            </a>
            <a className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1 hover:opacity-80 transition-opacity" href="#">
                <span className="material-symbols-outlined">auto_awesome</span>
                <span className="font-label-sm text-label-sm">Automation</span>
            </a>
            <a className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1 hover:opacity-80 transition-opacity" href="#">
                <span className="material-symbols-outlined">insights</span>
                <span className="font-label-sm text-label-sm">Analytics</span>
            </a>
            <a className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1 hover:opacity-80 transition-opacity" href="#">
                <span className="material-symbols-outlined">settings</span>
                <span className="font-label-sm text-label-sm">Settings</span>
            </a>
        </nav>
    );
}
