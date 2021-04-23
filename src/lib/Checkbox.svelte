<script lang='ts'>
  export let label: string = ''
  export let checked: boolean
</script>

<label class="checkbox">
  {label}
  <input
    type='checkbox'
    bind:checked
    on:change
  />
  <span class='checkmark'></span>
</label>


<style>
  .checkbox {
    @apply select-none container block relative cursor-pointer text-xl pl-8;
  }
  .checkbox input {
    @apply absolute opacity-0 left-0 top-0 cursor-pointer
  }
  .checkbox span {
    @apply h-6 w-6 absolute top-0 left-0 bg-gray-400;
  }
  
  .checkbox:hover input ~ .checkmark {
    background-color: #a0aec0;
  }

  .checkbox input:checked ~ .checkmark {
    background-color: #0078d4;
  }

  .checkmark:after {
    content: "";
    position: absolute;
    display: none;
  }

  .checkbox input:checked ~ .checkmark:after {
    display: block;
  }

  .checkbox .checkmark:after {
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