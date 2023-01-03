<script lang='ts'>
  export let label: string = ''
  export let checked: boolean
</script>

<label class="select-none container block relative cursor-pointer text-lg pl-8 break-all">
  {label}
  <input
    type='checkbox'
    bind:checked
    on:change
    class="absolute opacity-0 left-0 top-0 cursor-pointer"
  />
  <span class='h-6 w-6 absolute top-0 left-0 bg-gray-400'></span>
</label>


<style>
  label:hover input ~ span {
    background-color: #a0aec0;
  }

  label input:checked ~ span {
    background-color: #0078d4;
  }

  span:after {
    content: "";
    position: absolute;
    display: none;
  }

  label input:checked ~ span:after {
    display: block;
  }

  label span:after {
    left: 9px;
    top: 6px;
    width: 5px;
    height: 10px;
    border: solid white;
    border-width: 0 3px 3px 0;
    -webkit-transform: rotate(45deg);
    -ms-transform: rotate(45deg);
    transform: rotate(45deg);
  }
</style>