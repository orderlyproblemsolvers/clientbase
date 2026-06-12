export const useGlobalSearch = () => {
  const isOpen = useState('global-search-open', () => false)
  return { isOpen }
}