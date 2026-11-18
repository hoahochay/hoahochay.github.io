/**
 * Bố cục điện thoại: màn hẹp (dọc) hoặc màn thấp (điện thoại xoay ngang).
 * Phải khớp với các khối @media trong style.css.
 */
export const PHONE_MQ = '(max-width: 700px), (max-height: 500px)';
export const phoneQuery = window.matchMedia(PHONE_MQ);
export const isPhone = (): boolean => phoneQuery.matches;
