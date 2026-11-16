/**
 * 漫画未读话数的水波纹角标。
 *
 * @keyframes（ping-scale 等）定义在 src/app/globals.css，并与 ContinueWatching
 * 的更新角标共用——不要删除或改名。
 * 这里只保留一圈扩散光环（播 3 次、尊重减少动态偏好），配色为书库赭石。
 */
export default function RippleCountBadge({ count }: { count: number }) {
  return (
    <div className='pointer-events-none absolute right-2 top-2 z-20 h-7 w-7'>
      <span className='absolute inset-0 rounded-full bg-library-ochre motion-safe:animate-[ping-scale_1.5s_cubic-bezier(0,0,0.2,1)_3] dark:bg-library-night-ochre' />
      <span className='absolute inset-0 flex items-center justify-center rounded-full bg-library-ochre text-[11px] font-bold text-white shadow-sm dark:bg-library-night-ochre dark:text-library-night'>
        +{count}
      </span>
    </div>
  );
}
