import { useEffect } from 'react';

/**
 * Makes every `.modal` card draggable by its `.modal-header`, app-wide.
 *
 * Uses event delegation on the document so it works for any modal regardless
 * of which page rendered it, without each page having to opt in. The offset is
 * stored on the element's dataset so a drag can resume from where it was left;
 * a freshly opened modal is a new DOM node, so it always starts centred.
 */
export function useDraggableModals(): void {
    useEffect(() => {
        const onMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) return;

            const target = e.target as HTMLElement;
            const header = target.closest<HTMLElement>('.modal-header');
            if (!header) return;

            // Let interactive controls in the header behave normally.
            if (target.closest('button, a, input, select, textarea, label')) return;

            const modal = header.closest<HTMLElement>('.modal');
            if (!modal) return;

            e.preventDefault();

            const startX = e.clientX;
            const startY = e.clientY;
            const baseX = Number(modal.dataset.dragX ?? '0');
            const baseY = Number(modal.dataset.dragY ?? '0');

            const rect = modal.getBoundingClientRect();
            // Position the modal would have with no transform applied.
            const baseLeft = rect.left - baseX;
            const baseTop = rect.top - baseY;
            const prevUserSelect = document.body.style.userSelect;
            document.body.style.userSelect = 'none';
            modal.style.transition = 'none';

            const onMouseMove = (ev: MouseEvent) => {
                let nextX = baseX + (ev.clientX - startX);
                let nextY = baseY + (ev.clientY - startY);

                // Keep at least a strip of the modal on screen so it can't be lost.
                const margin = 48;
                const minX = margin - rect.width - baseLeft;
                const maxX = window.innerWidth - margin - baseLeft;
                const minY = margin - baseTop;
                const maxY = window.innerHeight - margin - baseTop;

                nextX = Math.min(Math.max(nextX, minX), maxX);
                nextY = Math.min(Math.max(nextY, minY), maxY);

                modal.style.transform = `translate(${nextX}px, ${nextY}px)`;
                modal.dataset.dragX = String(nextX);
                modal.dataset.dragY = String(nextY);
            };

            const onMouseUp = () => {
                document.body.style.userSelect = prevUserSelect;
                modal.style.transition = '';
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousedown', onMouseDown);
        return () => document.removeEventListener('mousedown', onMouseDown);
    }, []);
}
